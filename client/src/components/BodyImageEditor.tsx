import { useCallback, useEffect, useRef, useState } from "react";
import { uploadArticleAsset, buildArticleAssetUrl, renderArticle } from "../lib/api";
import type { ArticleDetail } from "../types";

/**
 * BodyImageEditor — B 方案重写版
 * ------------------------------------------------------------
 * 核心契约(2026-06-20 重构):
 *
 *   1) 不再直接修改 editorRef.current.innerHTML — 全部通过 onEditorMutate
 *      回调把 HTML 推给 WorkbenchPage,由 React 单向数据流同步到 DOM。
 *
 *   2) 粘贴/拖拽上传 → POST /api/articles/:id/assets → 返回 ArticleDetail
 *      (server 已自动重渲染,payload.renderedHtml 包含新的 figure)
 *      → 调 onArticleUploaded(payload) → WorkbenchPage 同步 article + editableHtml
 *
 *   3) 工具栏(替换/上移/下移/删除) → 直接操作 editorRef.current DOM,
 *      提取 innerHTML → 调 onEditorMutate(html) → 标记 dirty 但不调 server。
 *      用户按"保存正文"按钮时才同步。
 *
 *   4) 占位符(<p>【此处插入...】</p>)→ 装饰成可点击 + dashed 边框。
 *      点击触发隐藏 file input → 选图后调 onArticleUploaded(pasted upload flow)
 */

const TOOLBAR_PLACEHOLDER_LABEL = "📷 上传图片";

export interface BodyImageEditorProps {
  editorRef: React.RefObject<HTMLDivElement | null>;
  article: ArticleDetail;
  /** WorkbenchPage 的本地可编辑 HTML state(只读,不能直接修改) */
  editableHtml: string;
  /**
   * 修改本地编辑 HTML 的回调 — paste / 工具栏 上移/下移/删除 都通过它。
   * WorkbenchPage 内部会 setIsContentDirty(true)。
   */
  onEditorMutate: (nextHtml: string) => void;
  /**
   * 上传图片成功后 server 返回 ArticleDetail(已重渲染)。
   * WorkbenchPage 会同步更新 article + editableHtml + dirty。
   */
  onArticleUploaded: (next: ArticleDetail) => void;
  onMessage: (message: string) => void;
  onError: (error: string) => void;
}

export function BodyImageEditor({
  editorRef,
  article,
  editableHtml,
  onEditorMutate,
  onArticleUploaded,
  onMessage,
  onError
}: BodyImageEditorProps) {
  // pickerKey 用来每次替换时强制 unmount/remount file input,避免浏览器缓存 fileList
  // (Bug 2 根因:同一 input 元素多次 click,第二次 click 文件选择器显示旧 file)
  const [pickerKey, setPickerKey] = useState<number>(0);
  const pendingSlotRef = useRef<string | null>(null);

  // ===== 找出第一个空 slot =====
  // 用宽松判定:storageKey/localPath 任一为空字符串/undefined/null 都视为空
  // (server 端可能返回 "" 而不是 null,前者 !s.storageKey 是 true 但 s.storageKey 也不是 null)
  const findFirstEmptySlotId = useCallback((article: ArticleDetail): string | null => {
    const isEmpty = (v: string | null | undefined): boolean => !v || v.trim() === "";
    const empty = article.mediaAssets.bodyImages.find(
      (s) => isEmpty(s.storageKey) && isEmpty(s.localPath)
    );
    return empty?.id ?? null;
  }, []);

  // ===== 上传一个 file 到 slot,返回新 ArticleDetail =====
  const uploadFile = useCallback(
    async (file: File, slotId: string | null): Promise<ArticleDetail> => {
      const payload = await uploadArticleAsset({
        articleId: article.id,
        kind: "body",
        file,
        slotId: slotId ?? undefined
      });
      return payload;
    },
    [article.id]
  );

  // ===== 文件到达 → 上传 → 通知 WorkbenchPage =====
  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (imageFiles.length === 0) {
        onError("粘贴/拖拽的内容里没有图片文件");
        return;
      }

      let lastUploaded: ArticleDetail | null = null;
      for (const file of imageFiles) {
        try {
          // 先看有没有 pendingSlotRef(用户主动选了 slot,比如点替换按钮)
          let slotId = pendingSlotRef.current;
          pendingSlotRef.current = null;
          // 没有 pending 就找第一个空 slot
          if (!slotId) {
            slotId = findFirstEmptySlotId(article);
          }
          // 全部 slot 都满了(Bug 3):不再硬报错,改成"询问用户覆盖最后一张"
          // 但服务端 saveArticleAsset 会直接 overwrite storageKey,所以选最后一个 slot 也安全
          if (!slotId) {
            const fallbackSlot = article.mediaAssets.bodyImages[article.mediaAssets.bodyImages.length - 1];
            slotId = fallbackSlot?.id ?? null;
            if (!slotId) {
              onError("这篇文章没有图片槽位,请新建一篇文章");
              return;
            }
            onError(
              `所有图片槽位已满,自动覆盖最后一张 (slot: ${slotId})。如不想覆盖请先在 Markdown 里删除对应图。`
            );
          }
          const updated = await uploadFile(file, slotId);
          lastUploaded = updated;
          onArticleUploaded(updated);
        } catch (err) {
          onError(err instanceof Error ? err.message : `上传 ${file.name} 失败`);
          return;
        }
      }

      if (lastUploaded) {
        onMessage(`已上传 ${imageFiles.length} 张图片`);
      }
    },
    [article, uploadFile, findFirstEmptySlotId, onArticleUploaded, onError, onMessage]
  );

  // ===== paste 事件 =====
  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const files = Array.from(e.clipboardData.files);
      if (files.length === 0) return;
      e.preventDefault();
      void handleFiles(files);
    };
    root.addEventListener("paste", onPaste);
    return () => root.removeEventListener("paste", onPaste);
  }, [editorRef, handleFiles]);

  // ===== drop 事件 =====
  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) {
        e.preventDefault();
        root.classList.add("drop-target-active");
      }
    };
    const onDragLeave = () => root.classList.remove("drop-target-active");
    const onDrop = (e: DragEvent) => {
      root.classList.remove("drop-target-active");
      if (!e.dataTransfer?.files || e.dataTransfer.files.length === 0) return;
      e.preventDefault();
      void handleFiles(e.dataTransfer.files);
    };
    root.addEventListener("dragover", onDragOver);
    root.addEventListener("dragleave", onDragLeave);
    root.addEventListener("drop", onDrop);
    return () => {
      root.removeEventListener("dragover", onDragOver);
      root.removeEventListener("dragleave", onDragLeave);
      root.removeEventListener("drop", onDrop);
    };
  }, [editorRef, handleFiles]);

  // ===== 每次 editableHtml 变 → 给 figure 挂工具栏 + 给占位符挂点击 =====
  /**
   * 用 rAF 延迟到下一帧再 attach,因为 WorkbenchPage 的 useEffect 也在同一
   * React commit 里跑(设 innerHTML),两者执行顺序不确定,延迟一帧保证 DOM 已就绪。
   */
  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      const root = editorRef.current;
      if (!root) return;
      decorateExistingFigures(root);
      decoratePlaceholders(root, () => triggerSlotUpload());
    });
    return () => cancelAnimationFrame(rafId);
  }, [editableHtml, article?.id]);

  // ===== 工具栏(内联在 figure 内) =====
  function attachFigureToolbar(figure: HTMLElement, slotId: string) {
    if (figure.querySelector(":scope > .body-image-toolbar")) return;
    figure.style.position = "relative";

    const toolbar = document.createElement("div");
    toolbar.className = "body-image-toolbar";
    toolbar.style.cssText = `
      position: absolute; top: 8px; right: 8px;
      display: flex; gap: 4px;
      background: rgba(0,0,0,0.7); border-radius: 8px; padding: 4px;
      z-index: 10;
      opacity: 0; transition: opacity 0.15s;
    `;
    figure.addEventListener("mouseenter", () => (toolbar.style.opacity = "1"));
    figure.addEventListener("mouseleave", () => (toolbar.style.opacity = "0"));
    figure.addEventListener("focusin", () => (toolbar.style.opacity = "1"));
    figure.addEventListener("focusout", () => (toolbar.style.opacity = "0"));

    const buttons: { label: string; title: string; onClick: () => void; danger?: boolean }[] = [
      { label: "🔁", title: "替换", onClick: () => triggerSlotUpload(slotId) },
      { label: "↑", title: "上移", onClick: () => moveFigure(figure, "up") },
      { label: "↓", title: "下移", onClick: () => moveFigure(figure, "down") },
      { label: "🗑", title: "删除", onClick: () => deleteFigure(figure, slotId), danger: true }
    ];
    buttons.forEach((b) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = b.label;
      btn.title = b.title;
      btn.style.cssText = `
        background: ${b.danger ? "#c0392b" : "rgba(255,255,255,0.15)"};
        color: white; border: 0; border-radius: 6px; padding: 4px 8px;
        font-size: 14px; cursor: pointer; line-height: 1;
      `;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        b.onClick();
      });
      toolbar.appendChild(btn);
    });
    figure.appendChild(toolbar);
  }

  function decorateExistingFigures(root: HTMLElement) {
    root.querySelectorAll<HTMLElement>("figure[data-codex-media-slot]").forEach((fig) => {
      const slotId = fig.getAttribute("data-codex-media-slot");
      if (slotId) attachFigureToolbar(fig, slotId);
    });
  }

  function decoratePlaceholders(root: HTMLElement, onClick: () => void) {
    root.querySelectorAll<HTMLElement>("p").forEach((p) => {
      const text = p.textContent ?? "";
      if (text.includes("【此处插入")) {
        if (p.classList.contains("placeholder-clickable")) return;
        p.classList.add("placeholder-clickable");
        p.style.cssText =
          "border: 1.5px dashed #c96442; border-radius: 8px; padding: 8px 12px; cursor: pointer; background: rgba(201,100,66,0.06);";
        p.title = "点击上传图片替换此占位符";
        p.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        });
      }
    });
  }

  function triggerSlotUpload(presetSlotId?: string) {
    pendingSlotRef.current = presetSlotId ?? null;
    // 关键(Bug 1/2 根因):每次点击前 increment pickerKey,React 会 unmount 旧 input 元素
    // 然后 mount 一个全新的 <input>,新 input 的 value 必空,避免浏览器缓存旧 fileList。
    // 用 rAF 等下一帧让 React commit 新 input,然后找 pickerKey 对应的新 input 触发 click
    setPickerKey((k) => k + 1);
    requestAnimationFrame(() => {
      const next = document.querySelectorAll<HTMLInputElement>('input[type=file][accept^="image"]');
      const last = next[next.length - 1];
      last?.click();
    });
  }

  /**
   * 上移/下移:操作 DOM 后立刻抽取 innerHTML 推给 WorkbenchPage。
   * 注意:不能等 setState 再读 DOM(闭包问题),直接在操作 DOM 后读。
   */
  function moveFigure(figure: HTMLElement, direction: "up" | "down") {
    const sibling = direction === "up" ? figure.previousElementSibling : figure.nextElementSibling;
    if (!sibling) return;
    if (direction === "up") {
      figure.parentNode?.insertBefore(figure, sibling);
    } else {
      figure.parentNode?.insertBefore(sibling, figure);
    }
    const root = editorRef.current;
    if (!root) return;
    onEditorMutate(root.innerHTML);
    onMessage(direction === "up" ? "图片已上移" : "图片已下移");
  }

  function deleteFigure(figure: HTMLElement, slotId: string) {
    if (!confirm(`删除这张图片(slot ${slotId})?\n\n点"保存正文"后会同步到 server。`)) return;
    figure.remove();
    const root = editorRef.current;
    if (!root) return;
    onEditorMutate(root.innerHTML);
    onMessage(`已删除 slot ${slotId} — 待保存`);
  }

  /**
   * 文件选择回调(替换 / 占位符点击 / 工具栏替换):
   * 上传 → server 返回 ArticleDetail → onArticleUploaded → WorkbenchPage 同步全部。
   */
  const onFilePickerChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;
      try {
        // 优先用用户在工具栏指定的 slot(替换 / 占位符点击 都会预设 pendingSlotRef)
        let slotId = pendingSlotRef.current;
        pendingSlotRef.current = null;
        // 没有指定就找第一个空 slot
        if (!slotId) {
          slotId = findFirstEmptySlotId(article);
        }
        // 全部 slot 都满了:fallback 到最后一个 slot(直接 overwrite,会提示用户)
        if (!slotId) {
          const fallbackSlot = article.mediaAssets.bodyImages[article.mediaAssets.bodyImages.length - 1];
          slotId = fallbackSlot?.id ?? null;
          if (slotId) {
            onError(`所有图片槽位已满,自动覆盖最后一张 (slot: ${slotId})`);
          }
        }
        if (!slotId) {
          onError("这篇文章没有图片槽位,请新建一篇文章");
          return;
        }
        const updated = await uploadFile(files[0], slotId);
        onArticleUploaded(updated);
        onMessage("图片已上传");
      } catch (err) {
        onError(err instanceof Error ? err.message : "上传失败");
      }
      // 注意:不要在这里 event.target.value="",因为 React unmount/remount 后 input 已不是同一元素
    },
    [article, uploadFile, findFirstEmptySlotId, onArticleUploaded, onError, onMessage]
  );

  return (
    <>
      {/* 用 pickerKey 强制 unmount/remount:每次 triggerSlotUpload 都生成新 key,
          React 销毁旧 input → 新 input value 必空,避免浏览器缓存旧 fileList (Bug 1/2 根因) */}
      <input
        key={pickerKey}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={onFilePickerChange}
      />
    </>
  );
}

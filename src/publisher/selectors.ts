export const WECHAT_SELECTORS_VERSION = "2024Q4" as const;
export const WECHAT_SELECTORS_LAST_VERIFIED = "2026-04-17" as const;

export function validateSelectors(): void {
  // Currently validated by fail-fast on selector mismatch during probe.
  // If WeChat UI changes, selectors will fail to match and throw with context.
}

export const WECHAT_SELECTORS = {
  bodyImageUploadInput: "#js_editor_insertimage input[type='file']",
  createDraftEntryCandidates: [
    // Home page "new creation" menu items (e.g. 文章/图文)
    ".new-creation__menu-item",
    // Direct editor links
    "a[href*='appmsg_edit_v2'][href*='isNew=1'][href*='type=77']",
    "a[title*='新建图文']",
    // Draft list entry (fallback)
    "a[href*='action=list_card'][href*='type=77']",
    "a[title='草稿箱']",
    "[data-testid='create-draft']",
    "a[href*='appmsg']",
    ".weui-desktop-menu a[href*='appmsg']"
  ],
  writeNewArticleCandidates: [
    "a[href*='appmsg_edit_v2'][href*='isNew=1'][href*='type=77']",
    "a[href*='appmsg_edit']",
    "a[title*='新建图文']",
    "a[title='写新文章']",
    ".new-creation__btn a",
    "#menuCreate a",
    ".weui-desktop-menu a[href*='appmsg_edit']"
  ],
  titleInputCandidates: [
    // WeChat MP now uses ProseMirror for the title editor; the hidden textarea is no longer the visible input.
    ".title-editor__input .ProseMirror[contenteditable='true']",
    "#js_title_main .ProseMirror[contenteditable='true']",
    "input[placeholder*='标题']",
    "textarea[placeholder*='标题']",
    "#activity-name",
    "textarea#title",
    "input#title"
  ],
  authorInputCandidates: [
    "input#author",
    "input[name='author']"
  ],
  digestInputCandidates: [
    "textarea#js_description",
    "textarea[name='digest']"
  ],
  bodyEditorCandidates: [
    // The body editor is inside the mock iframe #ueditor_0; the first bare ProseMirror
    // match would hit the title editor, so we scope it explicitly.
    "#ueditor_0 .ProseMirror[contenteditable='true']",
    ".rich_media_content .ProseMirror[contenteditable='true']",
    "div.ProseMirror[contenteditable='true']"
  ],
  coverFromContentCandidates: [
    ".js_selectCoverFromContent"
  ],
  coverChooserItemCandidates: [
    ".img_crop_panel .appmsg_content_img_item"
  ],
  coverCropDialog: ".cover-edit-new",
  coverPreviewCandidates: [
    ".js_cover_preview_new",
    ".js_cover_preview_square"
  ],
  saveDraftButtonCandidates: [
    "#js_submit button",
    "#js_submit",
    "#js_continue_save"
  ],
  saveSuccessCandidates: [
    "#js_save_success .inner",
    "#js_save_success_with_ad .inner",
    "#js_save_success_with_ad_op .inner",
    "#js_autosave"
  ]
} as const;

export const WECHAT_SELECTORS_VERSION = "2024Q4" as const;
export const WECHAT_SELECTORS_LAST_VERIFIED = "2026-04-17" as const;

export function validateSelectors(): void {
  // Currently validated by fail-fast on selector mismatch during probe.
  // If WeChat UI changes, selectors will fail to match and throw with context.
}

export const WECHAT_SELECTORS = {
  bodyImageUploadInput: "#js_editor_insertimage input[type='file']",
  createDraftEntryCandidates: [
    "a[title='草稿箱']",
    "a[href*='action=list_card'][href*='type=77']",
    "a[href*='appmsg_edit_v2'][href*='isNew=1'][href*='type=77']",
    "[data-testid='create-draft']",
    "a[href*='appmsg']",
    "a[title*='新建图文']",
    ".weui-desktop-menu a[href*='appmsg']",
    ".new-creation__menu-item"
  ],
  writeNewArticleCandidates: [
    "a[href*='appmsg_edit_v2'][href*='isNew=1'][href*='type=77']",
    "a[title='写新文章']"
  ],
  titleInputCandidates: [
    "textarea#title",
    "input#title",
    "input[placeholder='请输入标题']",
    "textarea[placeholder='请输入标题']",
    "#activity-name"
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
    "div.ProseMirror[contenteditable='true']",
    "#ueditor_0 .ProseMirror[contenteditable='true']"
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

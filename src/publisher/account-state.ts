import { probeWechatDraftEntry } from "./draft-probe.js";
import { ensureWechatLogin } from "./login.js";
import { getPublishAccountById, updatePublishAccount } from "../storage/publish.js";
import type { PublishAccount, PublishDraftProbe, PublishLoginProbe } from "../shared/types.js";

function requireAccount(accountId: string): PublishAccount {
  const account = getPublishAccountById(accountId);
  if (!account) {
    throw new Error("未找到对应的发布账号。");
  }

  return account;
}

export async function refreshAccountLoginState(accountId: string): Promise<{
  account: PublishAccount;
  probe: PublishLoginProbe;
}> {
  const account = requireAccount(accountId);
  const probe = await ensureWechatLogin(account);

  const updatedAccount = updatePublishAccount({
    ...account,
    status: probe.loginState === "authenticated" ? "ready" : "expired",
    lastValidatedAt: new Date().toISOString(),
    latestLoginProbe: probe,
    latestDraftProbe: account.latestDraftProbe ?? null,
    note:
      probe.loginState === "authenticated"
        ? "本地 Session 校验通过，可以继续尝试进入后台草稿箱。"
        : "本地 Session 仍无法进入后台，需要重新导入 cookies 或扫码登录。"
  });

  return {
    account: updatedAccount,
    probe
  };
}

export async function refreshAccountDraftProbe(input: {
  accountId: string;
  loginProbe: PublishLoginProbe;
  draftAppmsgId?: string | null;
  articleTitle?: string | null;
}): Promise<{
  account: PublishAccount;
  probe: PublishDraftProbe;
}> {
  const account = requireAccount(input.accountId);
  const probe = await probeWechatDraftEntry(account, {
    draftAppmsgId: input.draftAppmsgId ?? null,
    articleTitle: input.articleTitle ?? null
  });

  const updatedAccount = updatePublishAccount({
    ...account,
    status: input.loginProbe.loginState === "authenticated" ? "ready" : "expired",
    lastValidatedAt: new Date().toISOString(),
    latestLoginProbe: input.loginProbe,
    latestDraftProbe: probe,
    note: probe.draftEntryDetected
      ? probe.editorReachable
        ? "已进入公众号编辑器，准备继续执行内容填充。"
        : "已识别到草稿入口，但尚未稳定进入编辑器。"
      : "已进入公众号后台，但尚未识别到稳定的草稿入口。"
  });

  return {
    account: updatedAccount,
    probe
  };
}

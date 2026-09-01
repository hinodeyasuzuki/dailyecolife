export const PRIVACY_CONSENT_KEY = "ecolife.privacyPolicyConsent";
export const PRIVACY_POLICY_VERSION = "2026-08-31";

export const PRIVACY_POLICY_HTML = `
  <p>「エコライフ手帖」シリーズ（毎日エコライフ・修理の手帖・Myエコライフ記録 などの関連ツールを含む）は、家庭のエコライフに関する情報を記録・活用するためのアプリです。</p>
  <h4>1. 収集・保存する情報</h4>
  <p>利用者が入力した診断項目、機器、修理履歴、写真、光熱などの情報は、運営者が管理するサーバーに保存され、現在のCookieセッションに対応する利用者だけが取得できる非公開データとして管理されます。氏名、メールアドレスなどを入力しない限り、これらの情報から利用者を直接識別する情報を収集しません。</p>
  <h4>2. 外部通信</h4>
  <p>診断項目や分類などの表示に必要なマスタデータを、公開APIから取得します。サーバーへの保存のために、CookieとHTTPS通信を使用します。利用者が選択した場合に限り、Google Photosなどの外部サービスからのデータ取得、脱炭素家庭認定証やThird Handersなど情報公開可能なサービスと連携することができます。外部サービスへ渡される情報は、それぞれのサービスの利用条件・プライバシーポリシーに従います。</p>
  <h4>3. 情報の管理と削除</h4>
  <p>入力情報と写真は、同期先サーバーでCookieセッション単位に管理されます。ブラウザのCookieを削除すると、同じデータを呼び出せなくなる場合があります。サーバー保存データの削除を希望する場合は、運営者へ連絡してください。エクスポートしたファイルは利用者自身で管理し、第三者へ不用意に共有しないでください。</p>
  <h4>4. 改定</h4>
  <p>本ポリシーは、機能や連携先の変更に応じて改定することがあります。改定後にアプリを利用する際は、改めて同意をお願いする場合があります。</p>
  <p>制定日：2026年8月31日</p>
`;

export function hasPrivacyConsent(storage = window.localStorage) {
  return storage.getItem(PRIVACY_CONSENT_KEY) === PRIVACY_POLICY_VERSION;
}

export function recordConsent(storage = window.localStorage) {
  storage.setItem(PRIVACY_CONSENT_KEY, PRIVACY_POLICY_VERSION);
}

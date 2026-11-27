// English privacy policy. Mirrors policy-pl.tsx; keep the two in step.
import Link from "next/link";
import { Fill } from "./fill";

const SECTIONS = [
  ["admin", "Who is responsible for your data"],
  ["dane", "What data we collect"],
  ["cele", "Why, and on what legal basis"],
  ["agent", "The agent on your computer"],
  ["cookies", "Cookies and browser storage"],
  ["odbiorcy", "Who we share data with"],
  ["czas", "How long we keep data"],
  ["prawa", "Your rights"],
  ["bezpieczenstwo", "Security"],
  ["zmiany", "Changes to this policy"],
];

export default function PolicyEn() {
  return (
    <article className="policy">
      <h1>Privacy policy</h1>
      <p className="updated">Last updated: <Fill>[publication date]</Fill></p>
      <p className="lead">
        howmuchwaterdidaiused shows how much you work with AI assistants, what it costs and how much water the servers
        use for it. We collect only what that takes. Your prompt text and project names reach us only if you allow it.
      </p>

      <nav className="policy-toc" aria-label="Contents">
        <ol>{SECTIONS.map(([id, t]) => <li key={id}><a href={`#${id}`}>{t}</a></li>)}</ol>
      </nav>

      <h2 id="admin">1. Who is responsible for your data</h2>
      <p>
        The controller of your personal data is <Fill>[full name or company name]</Fill>, <Fill>[address]</Fill>.
        For anything about your data, write to <Fill>[e-mail address]</Fill>.
      </p>

      <h2 id="dane">2. What data we collect</h2>
      <p><b>Account.</b></p>
      <ul>
        <li>your e-mail address and display name,</li>
        <li>your password, stored only as a cryptographic hash (we never know your password),</li>
        <li>
          if you sign in with Google or GitHub: your account ID with that provider, name, e-mail address, profile picture
          and the access tokens the provider passes on at sign-in.
        </li>
      </ul>
      <p><b>Sessions and security.</b></p>
      <ul>
        <li>session ID, IP address, browser information (user agent) and session expiry time,</li>
        <li>a count of sign-in attempts linked to an IP address, used to block abuse,</li>
        <li>
          the agent key: a cryptographic hash and an encrypted copy, so the installer and the agent code come with the
          key already filled in.
        </li>
      </ul>
      <p><b>Stats sent by the agent</b>, for each prompt:</p>
      <ul>
        <li>when the prompt was sent and last answered, agent working time, the assistant's session ID,</li>
        <li>the model used, token counts, number of tools used, estimated cost and estimated water use,</li>
        <li>the prompt's character and word count, and whether it had a question, pasted text or an image,</li>
        <li>whether the prompt was interrupted, ended in an error or was corrected in the next prompt,</li>
        <li>the name of the project (folder) you work in, or a stand-in such as “project 1”, “project 2”…,</li>
        <li><b>only if you switch it on:</b> the prompt text (first 200 characters) and real project names.</li>
      </ul>
      <p><b>We do not collect</b> the assistant's answers, the contents of your files, your code or folder paths.</p>
      <p>
        <b>Server technical data.</b> The server running the site may keep standard logs (IP address, time and address
        of the request). <Fill>[fill in for your hosting: what is logged and for how long]</Fill>
      </p>

      <h2 id="cele">3. Why, and on what legal basis</h2>
      <ul>
        <li><b>Running your account and showing your report</b>: the service you use (Art. 6(1)(b) GDPR).</li>
        <li>
          <b>Prompt text and real project names</b>: your consent (Art. 6(1)(a) GDPR), which you give by switching
          these options on in the installer or the agent settings. You can withdraw it at any time (section 4).
        </li>
        <li>
          <b>Security</b>, such as sign-in limits and server logs: our legitimate interest in protecting the site and
          accounts (Art. 6(1)(f) GDPR).
        </li>
      </ul>
      <p>We do not sell data, show ads or profile you for marketing.</p>

      <h2 id="agent">4. The agent on your computer</h2>
      <p>
        The agent reads the local logs of your conversations with an AI assistant (Claude Code for now), counts stats
        from them and sends them to your account. Anonymising happens on your computer before anything is sent: with
        prompt text switched off, it never leaves your computer, and project names are replaced with numbers.
      </p>
      <p>
        When you switch off sharing prompt text or project names, the agent sends your history again at the next sync
        without that data and replaces the entries stored earlier. You can uninstall the agent at any time; data sent
        before stays in your account until it is deleted.
      </p>

      <h2 id="cookies">5. Cookies and browser storage</h2>
      <ul>
        <li>we use one essential session cookie to keep you signed in, and one that remembers your language,</li>
        <li>your theme (light, dark, system) is saved in your browser's storage,</li>
        <li>we use no advertising cookies and no third-party analytics.</li>
      </ul>

      <h2 id="odbiorcy">6. Who we share data with</h2>
      <ul>
        <li>the hosting company whose servers run the site: <Fill>[provider name, server country]</Fill>,</li>
        <li>
          Google or GitHub, if you sign in with them; they process data under their own privacy policies and may do so
          outside the European Economic Area.
        </li>
      </ul>
      <p>Otherwise we share your data with no one, unless the law requires it.</p>

      <h2 id="czas">7. How long we keep data</h2>
      <ul>
        <li>account data and stats: until your account is deleted,</li>
        <li>sessions: until they expire or you sign out,</li>
        <li>server logs: <Fill>[period, e.g. 30 days]</Fill>.</li>
      </ul>

      <h2 id="prawa">8. Your rights</h2>
      <p>
        You have the right to access, correct and delete your data, to restrict its processing, to data portability and
        to object to processing based on legitimate interest. You can withdraw consent at any time; this does not affect
        processing done before. To delete your account or use any other right, write to <Fill>[e-mail address]</Fill>.
      </p>
      <p>
        You can also complain to a data protection authority, in Poland the President of the Personal Data Protection
        Office (UODO), ul. Stawki 2, 00-193 Warsaw.
      </p>

      <h2 id="bezpieczenstwo">9. Security</h2>
      <ul>
        <li>connections to the site and data sent by the agent are encrypted (HTTPS),</li>
        <li>passwords and API keys are stored as cryptographic hashes, and the copy of the agent key is encrypted,</li>
        <li>if your agent key may have leaked, generate a new one on the Account page; the old one stops working at once.</li>
      </ul>

      <h2 id="zmiany">10. Changes to this policy</h2>
      <p>
        If we change how we process data, we will update this page and the date at the top. We will tell signed-in users
        about significant changes.
      </p>

      <p style={{ marginTop: 32 }}>
        <Link href="/about">What you get after signing in</Link>
      </p>
    </article>
  );
}

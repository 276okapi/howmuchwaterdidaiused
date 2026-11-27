// AI Water Tracker - instalator agenta dla Windows (AIWaterTracker-Setup.exe).
//
// Okienko, w którym użytkownik wybiera źródło danych, częstotliwość wysyłania i co udostępnia.
// Instalator pobiera ze strony aktualne pliki agenta (sync.ps1 + skrypt liczący) do
// %LOCALAPPDATA%\AIWaterTracker,
// zapisuje config.json, tworzy zadanie w Harmonogramie zadań (register-task.ps1) i od razu
// wysyła pierwsze dane. Uruchomiony ponownie (np. z menu Start) pozwala zmienić ustawienia
// albo odinstalować agenta.
//
// Adres strony i osobisty klucz API dopisuje do pliku .exe strona przy pobieraniu
// (znacznik CONFIG_MARKER + JSON na końcu pliku). Bez nich instalator pyta o nie w okienku.
//
// Kod zgodny z C# 5, żeby dało się go zbudować kompilatorem wbudowanym w Windows (build.cmd).

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Net;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

[assembly: AssemblyTitle("AI Water Tracker - instalator agenta")]
[assembly: AssemblyProduct("AI Water Tracker")]
[assembly: AssemblyVersion("1.0.0.0")]

namespace AIWaterTracker
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            // any unexpected error is shown and written to %TEMP%\AIWaterTracker-setup.log
            Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
            Application.ThreadException += delegate (object s, ThreadExceptionEventArgs e) { Fatal(e.Exception); };
            AppDomain.CurrentDomain.UnhandledException += delegate (object s, UnhandledExceptionEventArgs e) { Fatal(e.ExceptionObject as Exception); };
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new SetupForm());
        }

        public static string LogPath
        {
            get { return Path.Combine(Path.GetTempPath(), "AIWaterTracker-setup.log"); }
        }

        public static void Log(string message)
        {
            try { File.AppendAllText(LogPath, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "  " + message + Environment.NewLine, Encoding.UTF8); }
            catch (Exception) { }
        }

        static void Fatal(Exception ex)
        {
            Log("BŁĄD: " + ex);
            MessageBox.Show("Wystąpił nieoczekiwany błąd instalatora:\n\n" + (ex == null ? "?" : ex.Message)
                + "\n\nSzczegóły: " + LogPath, "AI Water Tracker", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    static class Agent
    {
        public const string CONFIG_MARKER = "#AIWT-CONFIG#";
        public const string TASK_NAME = "AI Water Tracker";
        // files of the agent, downloaded from <server>/api/agent/plik/<name>
        public static readonly string[] FILES = { "sync.ps1", "build-report.ps1", "register-task.ps1", "reguly.json", "woda.json", "ceny.json" };
        public static readonly string[] INTERVALS = { "30m", "1h", "6h", "1d" };
        public static readonly string[] INTERVAL_LABELS = { "co 30 minut", "co godzinę (zalecane)", "co 6 godzin", "raz dziennie (o 17:30)" };

        public static string InstallDir
        {
            get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AIWaterTracker"); }
        }
        public static string ShortcutPath
        {
            get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "AI Water Tracker.lnk"); }
        }
        public static string ClaudeDir
        {
            get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".claude", "projects"); }
        }

        static readonly JavaScriptSerializer Json = new JavaScriptSerializer();

        /// <summary>Config appended to this .exe by the site at download time, or null.</summary>
        public static Dictionary<string, object> EmbeddedConfig()
        {
            try
            {
                byte[] all = File.ReadAllBytes(Assembly.GetExecutingAssembly().Location);
                byte[] marker = Encoding.ASCII.GetBytes(CONFIG_MARKER);
                int from = Math.Max(0, all.Length - 16384);
                for (int i = all.Length - marker.Length; i >= from; i--)
                {
                    bool hit = true;
                    for (int j = 0; j < marker.Length; j++) { if (all[i + j] != marker[j]) { hit = false; break; } }
                    if (!hit) continue;
                    string text = Encoding.UTF8.GetString(all, i + marker.Length, all.Length - i - marker.Length).Trim();
                    return Json.Deserialize<Dictionary<string, object>>(text);
                }
            }
            catch (Exception) { }
            return null;
        }

        public static Dictionary<string, object> InstalledConfig()
        {
            string p = Path.Combine(InstallDir, "config.json");
            if (!File.Exists(p)) return null;
            try { return Json.Deserialize<Dictionary<string, object>>(File.ReadAllText(p, Encoding.UTF8)); }
            catch (Exception) { return null; }
        }

        public static string Str(Dictionary<string, object> d, string key)
        {
            object v;
            return d != null && d.TryGetValue(key, out v) && v != null ? Convert.ToString(v) : null;
        }
        public static bool Flag(Dictionary<string, object> d, string key)
        {
            object v;
            return d != null && d.TryGetValue(key, out v) && v is bool && (bool)v;
        }

        /// <summary>Downloads the current agent files from the site into the install folder.</summary>
        public static void DownloadFiles(string server)
        {
            Directory.CreateDirectory(InstallDir);
            ServicePointManager.SecurityProtocol |= (SecurityProtocolType)3072; // TLS 1.2
            using (var wc = new WebClient())
            {
                foreach (string name in FILES)
                {
                    string target = Path.Combine(InstallDir, name);
                    // the price history is only seeded: the agent keeps it up to date itself
                    if (name == "ceny.json" && File.Exists(target)) continue;
                    string tmp = target + ".tmp";
                    try { wc.DownloadFile(server.TrimEnd('/') + "/api/agent/plik/" + name + "?pobierz=1", tmp); }
                    catch (WebException ex)
                    {
                        throw new InvalidOperationException("Nie udało się pobrać plików agenta ze strony " + server + " (" + ex.Message + ").");
                    }
                    if (File.Exists(target)) File.Delete(target);
                    File.Move(tmp, target);
                }
            }
        }

        public static void WriteConfig(string server, string apiKey, string interval, bool shareText, bool shareProjects)
        {
            var cfg = new Dictionary<string, object>();
            cfg["server"] = server;
            cfg["apiKey"] = apiKey;
            cfg["sources"] = new[] { "claude-code" };
            cfg["interval"] = interval;
            cfg["shareText"] = shareText;
            cfg["shareProjects"] = shareProjects;
            cfg["installedAt"] = DateTimeOffset.Now.ToString("o");
            File.WriteAllText(Path.Combine(InstallDir, "config.json"), Json.Serialize(cfg), new UTF8Encoding(false));
        }

        /// <summary>Runs a PowerShell script from the install folder, hidden; returns its exit code.</summary>
        public static int RunScript(string script, string args)
        {
            var psi = new ProcessStartInfo("powershell.exe",
                "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"" + Path.Combine(InstallDir, script) + "\" " + args);
            psi.CreateNoWindow = true;
            psi.UseShellExecute = false;
            psi.WorkingDirectory = InstallDir;
            using (Process p = Process.Start(psi))
            {
                p.WaitForExit();
                return p.ExitCode;
            }
        }

        /// <summary>Last line written by sync.ps1 to its log (the result of the last sync).</summary>
        public static string LastLogLine()
        {
            string p = Path.Combine(InstallDir, "sync.log");
            if (!File.Exists(p)) return "";
            string[] lines = File.ReadAllLines(p, Encoding.UTF8);
            for (int i = lines.Length - 1; i >= 0; i--)
            {
                string l = lines[i];
                if (l.Length > 21 && char.IsDigit(l[0])) return l.Substring(21).Trim();
            }
            return "";
        }

        /// <summary>Keeps a copy of the installer in the install folder with a Start menu shortcut,
        /// so settings can be changed later without downloading it again.</summary>
        public static void CreateShortcut()
        {
            string self = Assembly.GetExecutingAssembly().Location;
            string copy = Path.Combine(InstallDir, "AIWaterTracker.exe");
            if (!string.Equals(Path.GetFullPath(self), Path.GetFullPath(copy), StringComparison.OrdinalIgnoreCase))
                File.Copy(self, copy, true);
            try
            {
                Type t = Type.GetTypeFromProgID("WScript.Shell");
                object shell = Activator.CreateInstance(t);
                object lnk = t.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { ShortcutPath });
                Type lt = lnk.GetType();
                lt.InvokeMember("TargetPath", BindingFlags.SetProperty, null, lnk, new object[] { copy });
                lt.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, lnk, new object[] { InstallDir });
                lt.InvokeMember("Description", BindingFlags.SetProperty, null, lnk, new object[] { "Ustawienia agenta AI Water Tracker" });
                lt.InvokeMember("Save", BindingFlags.InvokeMethod, null, lnk, null);
            }
            catch (Exception) { /* the shortcut is a convenience only */ }
        }

        public static void Uninstall()
        {
            if (File.Exists(Path.Combine(InstallDir, "register-task.ps1"))) RunScript("register-task.ps1", "-Remove");
            try { if (File.Exists(ShortcutPath)) File.Delete(ShortcutPath); } catch (Exception) { }
            // this .exe may be running from the folder: remove it after the process ends
            var psi = new ProcessStartInfo("cmd.exe", "/c timeout /t 2 >nul & rmdir /s /q \"" + InstallDir + "\"");
            psi.CreateNoWindow = true;
            psi.UseShellExecute = false;
            Process.Start(psi);
        }
    }

    class SetupForm : Form
    {
        static readonly Color Water = Color.FromArgb(15, 111, 166);
        static readonly Color Muted = Color.FromArgb(110, 110, 105);
        static readonly Color Warn = Color.FromArgb(150, 85, 0);

        readonly Dictionary<string, object> embedded = Agent.EmbeddedConfig();
        readonly Dictionary<string, object> installed = Agent.InstalledConfig();
        string server, apiKey;

        FlowLayoutPanel body;
        CheckBox chkClaude, chkText, chkProjects;
        ComboBox cmbInterval;
        TextBox txtServer, txtKey;
        Label lblStatus;
        ProgressBar progress;
        Button btnMain, btnCancel, btnUninstall;
        Panel donePanel;
        // what the main button does: install, then (after installing) open the report
        Action mainAction;
        Label lblDoneTitle, lblDoneText;

        public SetupForm()
        {
            server = Agent.Str(embedded, "server") ?? Agent.Str(installed, "server");
            apiKey = Agent.Str(embedded, "apiKey") ?? Agent.Str(installed, "apiKey");

            Text = "AI Water Tracker";
            Font = new Font("Segoe UI", 9.5f);
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(560, 720);
            BackColor = Color.White;
            try { Icon = Icon.ExtractAssociatedIcon(Assembly.GetExecutingAssembly().Location); } catch (Exception) { }

            BuildHeader();
            BuildFooter();
            BuildBody();
            BuildDonePanel();
        }

        // ---------- layout ----------

        void BuildHeader()
        {
            var header = new Panel { Dock = DockStyle.Top, Height = 78, BackColor = Water };
            var title = new Label
            {
                Text = "AI Water Tracker", ForeColor = Color.White, AutoSize = true,
                Font = new Font("Segoe UI Semibold", 15f), Location = new Point(22, 12)
            };
            var sub = new Label
            {
                Text = installed != null ? "Ustawienia agenta" : "Instalacja agenta",
                ForeColor = Color.FromArgb(220, 236, 246), AutoSize = true, Location = new Point(24, 46)
            };
            header.Controls.Add(title);
            header.Controls.Add(sub);
            Controls.Add(header);
        }

        void BuildFooter()
        {
            // status row on top, buttons below, so nothing covers the buttons
            var footer = new Panel { Dock = DockStyle.Bottom, Height = 86, BackColor = Color.FromArgb(246, 248, 249) };
            progress = new ProgressBar { Style = ProgressBarStyle.Marquee, Size = new Size(70, 8), Location = new Point(22, 16), Visible = false };
            lblStatus = new Label { AutoSize = false, Size = new Size(430, 20), Location = new Point(100, 10), ForeColor = Muted };
            btnUninstall = new Button { Text = "Odinstaluj", Size = new Size(100, 32), Location = new Point(20, 40), Visible = installed != null };
            btnCancel = new Button { Text = "Anuluj", Size = new Size(96, 32), Location = new Point(324, 40) };
            btnMain = new Button
            {
                Text = installed != null ? "Zapisz zmiany" : "Zainstaluj", Size = new Size(120, 32), Location = new Point(424, 40),
                BackColor = Water, ForeColor = Color.White, FlatStyle = FlatStyle.Flat
            };
            btnMain.FlatAppearance.BorderSize = 0;
            btnCancel.Click += delegate { Close(); };
            mainAction = Install;
            btnMain.Click += delegate { mainAction(); };
            btnUninstall.Click += delegate { UninstallClicked(); };
            AcceptButton = btnMain;
            CancelButton = btnCancel;
            footer.Controls.AddRange(new Control[] { progress, lblStatus, btnUninstall, btnCancel, btnMain });
            Controls.Add(footer);
        }

        void BuildBody()
        {
            body = new FlowLayoutPanel
            {
                Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false,
                AutoScroll = true, Padding = new Padding(20, 14, 20, 10)
            };
            Controls.Add(body);
            body.BringToFront();

            AddText("Agent co jakiś czas liczy statystyki Twojej pracy z asystentem AI na tym komputerze "
                + "i wysyła je na Twoje konto. Działa w tle: nic nie wyświetla i nie trzyma raportów na dysku. "
                + "Raport oglądasz na stronie.", SystemColors.ControlText, 0);

            // source
            AddHeading("Źródło danych");
            bool found = Directory.Exists(Agent.ClaudeDir);
            chkClaude = AddCheck("Claude Code" + (found ? "" : "  (nie znaleziono jeszcze danych na tym komputerze)"), true, true);
            foreach (string s in new[] { "OpenAI Codex CLI", "Gemini CLI", "Cursor", "GitHub Copilot" })
                AddCheck(s + "  (wkrótce)", false, false);

            // how often
            AddHeading("Jak często wysyłać dane");
            cmbInterval = new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList, Width = 260, Margin = new Padding(3, 2, 3, 4) };
            cmbInterval.Items.AddRange(Agent.INTERVAL_LABELS);
            int idx = Array.IndexOf(Agent.INTERVALS, Agent.Str(installed, "interval") ?? "1h");
            cmbInterval.SelectedIndex = idx < 0 ? 1 : idx;
            body.Controls.Add(cmbInterval);

            // privacy
            AddHeading("Prywatność");
            chkText = AddCheck("Udostępniaj treść promptów (pierwsze 200 znaków)", Agent.Flag(installed, "shareText"), true);
            chkProjects = AddCheck("Udostępniaj nazwy projektów (nazwy folderów)", Agent.Flag(installed, "shareProjects"), true);
            AddText("Bez treści promptów nie będzie raportów z promptów: widok Prompty nie pokaże najczęstszych słów, "
                + "sformułowań ani podglądu treści. Bez nazw projekty będą widoczne jako „projekt 1”, „projekt 2”… "
                + "Liczby (tokeny, czas, koszt, woda) są wysyłane zawsze. Anonimizacja odbywa się na tym komputerze.", Warn, 4);

            // connection
            if (string.IsNullOrEmpty(server) || string.IsNullOrEmpty(apiKey))
            {
                AddHeading("Połączenie z kontem");
                AddText("Najprościej pobierz instalator ze strony (zakładka Agent): ma już wpisany klucz Twojego konta.", Muted, 0);
                txtServer = AddInput("Adres strony", server ?? "https://");
                txtKey = AddInput("Klucz API", apiKey ?? "");
            }
            else
            {
                AddHeading("Konto");
                AddText("Połączone ze stroną " + server + ".", Muted, 0);
            }
        }

        void BuildDonePanel()
        {
            donePanel = new Panel { Dock = DockStyle.Fill, Visible = false, Padding = new Padding(24) };
            lblDoneTitle = new Label { AutoSize = true, Font = new Font("Segoe UI Semibold", 14f), Location = new Point(24, 24) };
            lblDoneText = new Label { AutoSize = true, MaximumSize = new Size(500, 0), Location = new Point(26, 64) };
            donePanel.Controls.Add(lblDoneTitle);
            donePanel.Controls.Add(lblDoneText);
            Controls.Add(donePanel);
            donePanel.BringToFront();
        }

        Label AddHeading(string text)
        {
            var l = new Label { Text = text, AutoSize = true, Font = new Font("Segoe UI Semibold", 10.5f), Margin = new Padding(0, 14, 0, 4) };
            body.Controls.Add(l);
            return l;
        }

        Label AddText(string text, Color color, int top)
        {
            var l = new Label { Text = text, AutoSize = true, MaximumSize = new Size(500, 0), ForeColor = color, Margin = new Padding(0, top, 0, 2) };
            body.Controls.Add(l);
            return l;
        }

        CheckBox AddCheck(string text, bool on, bool enabled)
        {
            var c = new CheckBox { Text = text, Checked = on, Enabled = enabled, AutoSize = true, Margin = new Padding(2, 1, 0, 1) };
            body.Controls.Add(c);
            return c;
        }

        TextBox AddInput(string label, string value)
        {
            body.Controls.Add(new Label { Text = label, AutoSize = true, Margin = new Padding(0, 6, 0, 1) });
            var t = new TextBox { Text = value, Width = 500 };
            body.Controls.Add(t);
            return t;
        }

        // ---------- actions ----------

        void SetBusy(bool busy, string status)
        {
            body.Enabled = !busy;
            btnMain.Enabled = btnCancel.Enabled = btnUninstall.Enabled = !busy;
            progress.Visible = busy;
            lblStatus.Text = status;
        }

        void Install()
        {
            if (!chkClaude.Checked)
            {
                MessageBox.Show(this, "Wybierz co najmniej jedno źródło danych.", Text, MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }
            if (txtServer != null)
            {
                server = txtServer.Text.Trim().TrimEnd('/');
                apiKey = txtKey.Text.Trim();
                if (!server.StartsWith("http") || apiKey.Length < 10)
                {
                    MessageBox.Show(this, "Podaj adres strony (https://...) i klucz API.", Text, MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return;
                }
            }
            string interval = Agent.INTERVALS[cmbInterval.SelectedIndex];
            string intervalLabel = Agent.INTERVAL_LABELS[cmbInterval.SelectedIndex].Replace(" (zalecane)", "");
            bool shareText = chkText.Checked, shareProjects = chkProjects.Checked;
            // changed sharing: send the whole history again, so the site gets the new form of it
            bool resendAll = installed == null
                || shareText != Agent.Flag(installed, "shareText")
                || shareProjects != Agent.Flag(installed, "shareProjects");

            SetBusy(true, "Pobieram agenta i instaluję…");
            var worker = new Thread(delegate ()
            {
                string error = null;
                int syncCode = 0;
                string last = "";
                try
                {
                    Program.Log("Instalacja: " + server + ", " + interval + ", treść=" + shareText + ", projekty=" + shareProjects);
                    Agent.DownloadFiles(server);
                    Agent.WriteConfig(server, apiKey, interval, shareText, shareProjects);
                    if (Agent.RunScript("register-task.ps1", "-Interval " + interval) != 0)
                        throw new InvalidOperationException("Nie udało się utworzyć zadania w Harmonogramie zadań.");
                    Agent.CreateShortcut();
                    BeginInvoke(new Action(delegate { lblStatus.Text = "Wysyłam dane, za pierwszym razem może to potrwać kilka minut…"; }));
                    syncCode = Agent.RunScript("sync.ps1", resendAll ? "-All -Quiet" : "-Quiet");
                    last = Agent.LastLogLine();
                    Program.Log("Synchronizacja: kod " + syncCode + ", " + last);
                }
                catch (Exception ex) { error = ex.Message; Program.Log("BŁĄD instalacji: " + ex); }

                BeginInvoke(new Action(delegate
                {
                    SetBusy(false, "");
                    if (error != null)
                    {
                        MessageBox.Show(this, "Instalacja nie powiodła się:\n\n" + error, Text, MessageBoxButtons.OK, MessageBoxIcon.Error);
                        return;
                    }
                    ShowDone(syncCode == 0, last, intervalLabel);
                }));
            });
            worker.IsBackground = true;
            worker.Start();
        }

        void ShowDone(bool synced, string last, string intervalLabel)
        {
            body.Visible = false;
            donePanel.Visible = true;
            lblDoneTitle.Text = synced ? "Gotowe" : "Zainstalowano";
            lblDoneTitle.ForeColor = synced ? Water : Warn;
            lblDoneText.Text = (synced ? "" : "Pierwsza wysyłka się nie udała, agent spróbuje ponownie przy następnym uruchomieniu.\n\n")
                + (last.Length > 0 ? last + ".\n\n" : "")
                + "Agent działa w tle i wysyła dane " + intervalLabel + ". Nie musisz nic więcej robić.\n\n"
                + "Ustawienia zmienisz albo odinstalujesz agenta z menu Start: „AI Water Tracker”.";
            btnUninstall.Visible = false;
            btnCancel.Text = "Zamknij";
            btnMain.Text = "Otwórz raport";
            mainAction = delegate
            {
                try { Process.Start(server.TrimEnd('/') + "/pulpit"); } catch (Exception) { }
                Close();
            };
        }

        void UninstallClicked()
        {
            var answer = MessageBox.Show(this,
                "Odinstalować agenta? Zadanie w Harmonogramie i folder agenta zostaną usunięte.\n\n"
                + "Dane wysłane wcześniej zostają na Twoim koncie, a klucz API możesz usunąć na stronie (Klucze API).",
                Text, MessageBoxButtons.YesNo, MessageBoxIcon.Question);
            if (answer != DialogResult.Yes) return;
            SetBusy(true, "Odinstalowuję…");
            var worker = new Thread(delegate ()
            {
                string error = null;
                try { Agent.Uninstall(); } catch (Exception ex) { error = ex.Message; }
                BeginInvoke(new Action(delegate
                {
                    SetBusy(false, "");
                    MessageBox.Show(this, error == null ? "Agent został odinstalowany." : "Nie udało się odinstalować:\n\n" + error,
                        Text, MessageBoxButtons.OK, error == null ? MessageBoxIcon.Information : MessageBoxIcon.Error);
                    if (error == null) Close();
                }));
            });
            worker.IsBackground = true;
            worker.Start();
        }
    }
}

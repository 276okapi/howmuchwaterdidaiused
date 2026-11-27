// howmuchwaterdidaiused - instalator agenta dla Windows (howmuchwaterdidaiused-setup.exe).
//
// Okienko, w którym użytkownik wybiera źródło danych, częstotliwość wysyłania i co udostępnia.
// Instalator pobiera ze strony aktualne pliki agenta (sync.ps1 + skrypt liczący) do
// %LOCALAPPDATA%\howmuchwaterdidaiused,
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
using System.Drawing.Drawing2D;
using System.IO;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

[assembly: AssemblyTitle("howmuchwaterdidaiused - instalator agenta")]
[assembly: AssemblyProduct("howmuchwaterdidaiused")]
[assembly: AssemblyVersion("1.0.0.0")]

namespace Howmuchwaterdidaiused
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            // any unexpected error is shown and written to %TEMP%\howmuchwaterdidaiused-setup.log
            Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
            Application.ThreadException += delegate (object s, ThreadExceptionEventArgs e) { Fatal(e.Exception); };
            AppDomain.CurrentDomain.UnhandledException += delegate (object s, UnhandledExceptionEventArgs e) { Fatal(e.ExceptionObject as Exception); };
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new SetupForm());
        }

        public static string LogPath
        {
            get { return Path.Combine(Path.GetTempPath(), "howmuchwaterdidaiused-setup.log"); }
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
                + "\n\nSzczegóły: " + LogPath, "howmuchwaterdidaiused", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    static class Agent
    {
        public const string CONFIG_MARKER = "#AIWT-CONFIG#";
        public const string TASK_NAME = "howmuchwaterdidaiused";
        // files of the agent, downloaded from <server>/api/agent/plik/<name>
        public static readonly string[] FILES = { "sync.ps1", "build-report.ps1", "register-task.ps1", "reguly.json", "woda.json", "ceny.json" };
        public static readonly string[] INTERVALS = { "30m", "1h", "6h", "1d" };
        public static readonly string[] INTERVAL_LABELS = { "co 30 minut", "co godzinę (zalecane)", "co 6 godzin", "raz dziennie (o 17:30)" };

        public static string InstallDir
        {
            get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "howmuchwaterdidaiused"); }
        }
        public static string ShortcutPath
        {
            get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "howmuchwaterdidaiused.lnk"); }
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
            string copy = Path.Combine(InstallDir, "howmuchwaterdidaiused.exe");
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
                lt.InvokeMember("Description", BindingFlags.SetProperty, null, lnk, new object[] { "Ustawienia agenta howmuchwaterdidaiused" });
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

    // ---------- look of the website: colors and small custom controls ----------

    static class Ui
    {
        public static readonly Color Page = Color.FromArgb(249, 249, 247);
        public static readonly Color Foam = Color.FromArgb(233, 244, 249);
        public static readonly Color Navy = Color.FromArgb(11, 44, 64);
        public static readonly Color Ink = Color.FromArgb(11, 11, 11);
        public static readonly Color Ink2 = Color.FromArgb(82, 81, 78);
        public static readonly Color Muted = Color.FromArgb(137, 135, 129);
        public static readonly Color Border = Color.FromArgb(222, 222, 218);
        public static readonly Color Water = Color.FromArgb(26, 134, 196);
        public static readonly Color Deep = Color.FromArgb(11, 79, 118);
        public static readonly Color Crest = Color.FromArgb(92, 191, 233);
        public static readonly Color Button = Color.FromArgb(15, 111, 166);
        public static readonly Color ButtonHover = Color.FromArgb(11, 94, 141);
        public static readonly Color Selected = Color.FromArgb(227, 241, 248);
        public static readonly Color Warn = Color.FromArgb(150, 85, 0);

        public static Font F(float size, bool semibold)
        {
            return new Font(semibold ? "Segoe UI Semibold" : "Segoe UI", size);
        }

        public static GraphicsPath Round(Rectangle r, int radius)
        {
            int d = radius * 2;
            var p = new GraphicsPath();
            p.AddArc(r.X, r.Y, d, d, 180, 90);
            p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            p.CloseFigure();
            return p;
        }
    }

    /// <summary>Rounded button: primary (blue, like the site's main button) or outline.</summary>
    class RoundButton : Button
    {
        public bool Primary;
        bool hover;

        public RoundButton()
        {
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            FlatStyle = FlatStyle.Flat;
            Cursor = Cursors.Hand;
            Font = Ui.F(9.75f, true);
        }

        protected override void OnMouseEnter(EventArgs e) { hover = true; Invalidate(); base.OnMouseEnter(e); }
        protected override void OnMouseLeave(EventArgs e) { hover = false; Invalidate(); base.OnMouseLeave(e); }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.Clear(Parent != null ? Parent.BackColor : Ui.Page);
            var r = new Rectangle(0, 0, Width - 1, Height - 1);
            Color bg = Primary ? (!Enabled ? Color.FromArgb(160, 192, 211) : hover ? Ui.ButtonHover : Ui.Button)
                               : (hover && Enabled ? Ui.Selected : Color.White);
            using (GraphicsPath path = Ui.Round(r, 8))
            using (var b = new SolidBrush(bg))
            {
                g.FillPath(b, path);
                if (!Primary) using (var pen = new Pen(Ui.Border)) g.DrawPath(pen, path);
            }
            Color fg = Primary ? Color.White : (Enabled ? Ui.Ink : Ui.Muted);
            TextRenderer.DrawText(g, Text, Font, r, fg, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
            if (Focused && ShowFocusCues)
                using (GraphicsPath path = Ui.Round(new Rectangle(2, 2, Width - 5, Height - 5), 7))
                using (var pen = new Pen(Primary ? Color.White : Ui.Water)) g.DrawPath(pen, path);
        }
    }

    /// <summary>On/off switch like on the website (the label is a separate control).</summary>
    class ToggleSwitch : CheckBox
    {
        public ToggleSwitch()
        {
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer, true);
            Size = new Size(40, 24);
            Cursor = Cursors.Hand;
            Text = "";
        }

        protected override void OnCheckedChanged(EventArgs e) { Invalidate(); base.OnCheckedChanged(e); }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.Clear(Parent != null ? Parent.BackColor : Ui.Page);
            var track = new Rectangle(1, (Height - 20) / 2, 36, 20);
            using (GraphicsPath p = Ui.Round(track, 10))
            using (var b = new SolidBrush(Checked ? Ui.Water : Color.FromArgb(205, 209, 212)))
                g.FillPath(b, p);
            int x = Checked ? track.Right - 18 : track.X + 2;
            using (var knob = new SolidBrush(Color.White))
                g.FillEllipse(knob, x, track.Y + 2, 16, 16);
            if (Focused && ShowFocusCues)
                using (GraphicsPath p = Ui.Round(new Rectangle(0, track.Y - 1, 38, 22), 11))
                using (var pen = new Pen(Ui.Deep)) g.DrawPath(pen, p);
        }
    }

    /// <summary>One option of a row of choices (how often), like the site's segmented buttons.</summary>
    class ChoiceButton : RadioButton
    {
        public ChoiceButton()
        {
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer, true);
            Appearance = Appearance.Button;
            Cursor = Cursors.Hand;
            Font = Ui.F(9.25f, false);
        }

        protected override void OnCheckedChanged(EventArgs e) { Invalidate(); base.OnCheckedChanged(e); }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.Clear(Parent != null ? Parent.BackColor : Ui.Page);
            var r = new Rectangle(0, 0, Width - 1, Height - 1);
            using (GraphicsPath p = Ui.Round(r, 7))
            {
                using (var b = new SolidBrush(Checked ? Ui.Selected : Color.White)) g.FillPath(b, p);
                using (var pen = new Pen(Checked ? Ui.Water : Ui.Border, Checked ? 1.5f : 1f)) g.DrawPath(pen, p);
            }
            using (Font f = Checked ? Ui.F(Font.Size, true) : null)
                TextRenderer.DrawText(g, Text, f ?? Font, r, Checked ? Ui.Deep : Ui.Ink2,
                    TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        }
    }

    /// <summary>Left side of the window: the same "water jug" as on the website's sign-in page.</summary>
    class WaterPanel : Panel
    {
        public string SiteLabel = "howmuchwaterdidaiused.com";

        public WaterPanel()
        {
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            BackColor = Ui.Foam;
        }

        public int WaterTop { get { return (int)(Height * 0.6); } }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;
            int w = Width, h = Height, top = WaterTop;

            // brand: drop + name
            // the site's drop: a square rounded on three corners, turned 45 degrees
            using (var b = new SolidBrush(Ui.Water))
            using (var drop = new GraphicsPath())
            using (var turn = new Matrix())
            {
                const int s = 13, x0 = 32, y0 = 32, r = 13;
                drop.AddArc(x0, y0, r, r, 180, 90);
                drop.AddLine(x0 + s / 2, y0, x0 + s, y0);
                drop.AddLine(x0 + s, y0, x0 + s, y0 + s / 2);
                drop.AddArc(x0, y0, r, r, 0, 90);
                drop.AddArc(x0, y0, r, r, 90, 90);
                drop.CloseFigure();
                turn.RotateAt(-45, new PointF(x0 + s / 2f, y0 + s / 2f));
                drop.Transform(turn);
                g.FillPath(b, drop);
            }
            using (Font f = Ui.F(11f, true))
            using (var b = new SolidBrush(Ui.Navy))
                g.DrawString("howmuchwaterdidaiused", f, b, 52, 28);

            // headline and a few words
            using (Font f = Ui.F(21f, true))
            using (var b = new SolidBrush(Ui.Navy))
                g.DrawString("Ile wody zużyła Twoja praca z AI?", f, b, new RectangleF(30, 84, w - 110, 130));
            using (Font f = Ui.F(10f, false))
            using (var b = new SolidBrush(Color.FromArgb(34, 73, 95)))
                g.DrawString("Każdy prompt to praca serwerów, a serwery chłodzi się wodą. Agent liczy tokeny na tym "
                    + "komputerze i zamienia je na szacunkowe litry, koszt i czas pracy.", f, b, new RectangleF(32, 218, w - 110, 90));

            // waves: a light crest behind, the water in front
            using (GraphicsPath back = Wave(w, h, top - 6, 9, 0.6f))
            using (var b = new SolidBrush(Color.FromArgb(140, Ui.Crest)))
                g.FillPath(b, back);
            using (GraphicsPath front = Wave(w, h, top + 4, 8, 0f))
            using (var b = new LinearGradientBrush(new Rectangle(0, top, w, h - top + 1), Ui.Water, Ui.Deep, LinearGradientMode.Vertical))
                g.FillPath(b, front);

            // jug graduations on the right edge: 0,5 l every 80 px, dark above the water, white below
            using (Font f = Ui.F(7.5f, false))
                for (int i = 1; i * 40 < h - 20; i++)
                {
                    int y = h - i * 40;
                    bool under = y > top + 6;
                    using (var pen = new Pen(under ? Color.FromArgb(140, 255, 255, 255) : Color.FromArgb(80, Ui.Navy)))
                        g.DrawLine(pen, w - (i % 2 == 0 ? 22 : 12), y, w, y);
                    if (i % 2 == 0)
                        using (var b = new SolidBrush(under ? Color.FromArgb(210, 255, 255, 255) : Color.FromArgb(140, Ui.Navy)))
                            g.DrawString((i / 4.0).ToString("0.#", new System.Globalization.CultureInfo("pl-PL")) + " l", f, b, w - 58, y - 7);
                }

            // a note in the water
            using (Font f = Ui.F(8.75f, false))
            using (var b = new SolidBrush(Color.FromArgb(225, 255, 255, 255)))
                g.DrawString("Przyjmujemy ok. 100 l wody na milion tokenów odpowiedzi modelu. To szacunek.", f, b,
                    new RectangleF(32, h - 112, w - 110, 40));
        }

        static GraphicsPath Wave(int w, int h, int y, int amp, float phase)
        {
            var p = new GraphicsPath();
            var pts = new List<PointF>();
            for (int x = 0; x <= w + 20; x += 10)
                pts.Add(new PointF(x, y + amp * (float)Math.Sin((x / (float)w) * Math.PI * 2.2 + phase * Math.PI)));
            p.AddCurve(pts.ToArray());
            p.AddLine(w + 20, y, w + 20, h + 1);
            p.AddLine(w + 20, h + 1, 0, h + 1);
            p.CloseFigure();
            return p;
        }
    }

    class SetupForm : Form
    {
        readonly Dictionary<string, object> embedded = Agent.EmbeddedConfig();
        readonly Dictionary<string, object> installed = Agent.InstalledConfig();
        string server, apiKey;

        WaterPanel side;
        Panel right, content, donePanel, footer;
        CheckBox chkClaude;
        ToggleSwitch tglText, tglProjects;
        ChoiceButton[] choices;
        TextBox txtServer, txtKey;
        Label lblStatus;
        ProgressBar progress;
        RoundButton btnMain, btnCancel;
        LinkLabel lnkUninstall;
        Label lblDoneTitle, lblDoneText;
        // what the main button does: install, then (after installing) open the report
        Action mainAction;

        const int W = 488; // width of the right column content

        public SetupForm()
        {
            server = Agent.Str(embedded, "server") ?? Agent.Str(installed, "server");
            apiKey = Agent.Str(embedded, "apiKey") ?? Agent.Str(installed, "apiKey");

            Text = "howmuchwaterdidaiused";
            Font = Ui.F(9.5f, false);
            FormBorderStyle = FormBorderStyle.FixedSingle;
            MaximizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(920, 640);
            BackColor = Ui.Page;
            try { Icon = Icon.ExtractAssociatedIcon(Assembly.GetExecutingAssembly().Location); } catch (Exception) { }

            right = new Panel { Dock = DockStyle.Fill, BackColor = Ui.Page };
            side = new WaterPanel { Dock = DockStyle.Left, Width = 360 };
            Controls.Add(right);
            Controls.Add(side);
            BuildSideLink();
            BuildFooter();
            BuildContent();
            BuildDonePanel();
        }

        string SiteUrl { get { return string.IsNullOrEmpty(server) ? "https://howmuchwaterdidaiused.com" : server.TrimEnd('/'); } }
        string SiteLabel { get { return SiteUrl.Replace("https://", "").Replace("http://", ""); } }

        void OpenSite(string path)
        {
            try { Process.Start(SiteUrl + path); } catch (Exception) { }
        }

        // ---------- layout ----------

        void BuildSideLink()
        {
            var link = new LinkLabel
            {
                Text = "Przejdź na stronę: " + SiteLabel, AutoSize = true, BackColor = Color.Transparent,
                LinkColor = Color.White, ActiveLinkColor = Color.FromArgb(223, 243, 251), VisitedLinkColor = Color.White,
                Font = Ui.F(9.5f, true), Location = new Point(30, side.Height - 64), Anchor = AnchorStyles.Left | AnchorStyles.Bottom,
                LinkBehavior = LinkBehavior.HoverUnderline
            };
            link.LinkArea = new LinkArea("Przejdź na stronę: ".Length, SiteLabel.Length);
            link.ForeColor = Color.FromArgb(225, 255, 255, 255);
            link.LinkClicked += delegate { OpenSite("/pulpit"); };
            side.Controls.Add(link);
        }

        void BuildFooter()
        {
            footer = new Panel { Dock = DockStyle.Bottom, Height = 76, BackColor = Ui.Page };
            footer.Paint += delegate (object s, PaintEventArgs e)
            {
                using (var pen = new Pen(Ui.Border)) e.Graphics.DrawLine(pen, 0, 0, footer.Width, 0);
            };
            progress = new ProgressBar { Style = ProgressBarStyle.Marquee, Size = new Size(W, 4), Location = new Point(36, 10), Visible = false };
            lblStatus = new Label { AutoSize = false, Size = new Size(205, 44), Location = new Point(36, 22), ForeColor = Ui.Muted, Font = Ui.F(8.75f, false) };
            lnkUninstall = new LinkLabel
            {
                Text = "Odinstaluj agenta", AutoSize = true, Location = new Point(36, 34), Visible = installed != null,
                LinkColor = Ui.Ink2, ActiveLinkColor = Ui.Water, LinkBehavior = LinkBehavior.HoverUnderline
            };
            btnCancel = new RoundButton { Text = "Anuluj", Size = new Size(104, 38), Location = new Point(36 + W - 104 - 10 - 156, 22) };
            btnMain = new RoundButton
            {
                Primary = true, Text = installed != null ? "Zapisz zmiany" : "Zainstaluj",
                Size = new Size(156, 38), Location = new Point(36 + W - 156, 22)
            };
            btnCancel.Click += delegate { Close(); };
            mainAction = Install;
            btnMain.Click += delegate { mainAction(); };
            lnkUninstall.LinkClicked += delegate { UninstallClicked(); };
            AcceptButton = btnMain;
            footer.Controls.AddRange(new Control[] { progress, lblStatus, lnkUninstall, btnCancel, btnMain });
            right.Controls.Add(footer);
        }

        void BuildContent()
        {
            content = new Panel { Dock = DockStyle.Fill, BackColor = Ui.Page };
            right.Controls.Add(content);
            content.BringToFront();
            Control c;
            int y = 26;

            c = Add(new Label { Text = installed != null ? "Ustawienia agenta" : "Instalacja agenta", AutoSize = true, Font = Ui.F(17f, true), ForeColor = Ui.Ink }, 0, y);
            y = c.Bottom + 6;
            c = Add(Wrap("Agent działa w tle i co jakiś czas wysyła statystyki na Twoje konto. Na komputerze nic nie wyświetla i nie zapisuje raportów.", Ui.Ink2, 9.5f), 0, y);
            y = c.Bottom + 18;

            // source
            c = Add(Heading("Źródło danych"), 0, y);
            y = c.Bottom + 6;
            chkClaude = new CheckBox { Text = "Claude Code", Checked = true, AutoSize = true, Font = Ui.F(9.5f, true) };
            Add(chkClaude, 0, y);
            string[] soon = { "OpenAI Codex CLI", "Gemini CLI", "Cursor", "GitHub Copilot" };
            for (int i = 0; i < soon.Length; i++)
            {
                int col = (i + 1) % 2, row = (i + 1) / 2;
                Add(new CheckBox { Text = soon[i] + "  (wkrótce)", Enabled = false, AutoSize = true }, col * 244, y + row * 24);
            }
            y += 3 * 24;
            if (!Directory.Exists(Agent.ClaudeDir))
            {
                c = Add(Wrap("Nie widać jeszcze danych Claude Code na tym komputerze. Agent zacznie je wysyłać, gdy się pojawią.", Ui.Warn, 8.75f), 0, y);
                y = c.Bottom;
            }
            y += 16;

            // how often
            c = Add(Heading("Jak często wysyłać dane"), 0, y);
            y = c.Bottom + 8;
            string[] labels = { "co 30 min", "co godzinę", "co 6 godzin", "raz dziennie" };
            choices = new ChoiceButton[4];
            int cur = Array.IndexOf(Agent.INTERVALS, Agent.Str(installed, "interval") ?? "1h");
            int cw = (W - 3 * 8) / 4;
            for (int i = 0; i < 4; i++)
            {
                choices[i] = new ChoiceButton { Text = labels[i], Size = new Size(cw, 36), Checked = i == (cur < 0 ? 1 : cur) };
                Add(choices[i], i * (cw + 8), y);
            }
            y += 42;
            c = Add(Wrap("Zalecane: co godzinę. Częściej nie ma sensu, a rzadziej niż raz dziennie wyniki będą nieaktualne.", Ui.Muted, 8.75f), 0, y);
            y = c.Bottom + 16;

            // what is shared
            c = Add(Heading("Co udostępniasz"), 0, y);
            y = c.Bottom + 8;
            tglText = new ToggleSwitch { Checked = Agent.Flag(installed, "shareText") };
            y = Toggle(tglText, "Treść promptów",
                "Bez niej nie będzie raportów z promptów (najczęstsze słowa, sformułowania, podgląd treści).", y) + 10;
            tglProjects = new ToggleSwitch { Checked = Agent.Flag(installed, "shareProjects") };
            y = Toggle(tglProjects, "Nazwy projektów", "Bez nich: „projekt 1”, „projekt 2”… zamiast nazw folderów.", y) + 14;

            // connection
            if (string.IsNullOrEmpty(server) || string.IsNullOrEmpty(apiKey))
            {
                c = Add(Wrap("Pobierz instalator ze strony (zakładka Agent), żeby miał wpisany klucz konta, albo podaj go tutaj:", Ui.Muted, 8.75f), 0, y);
                y = c.Bottom + 4;
                txtServer = new TextBox { Text = server ?? "https://howmuchwaterdidaiused.com", Width = 236 };
                txtKey = new TextBox { Text = apiKey ?? "", Width = 236 };
                Add(txtServer, 0, y);
                Add(txtKey, 252, y);
            }
            else
            {
                Add(Wrap("Liczby (czas, tokeny, koszt, woda) są wysyłane zawsze. Anonimizacja odbywa się na tym komputerze. "
                    + "Połączone z kontem na " + SiteLabel + ".", Ui.Muted, 8.75f), 0, y);
            }
        }

        /// <summary>A switch with its name and what happens without it; returns the bottom of the block.</summary>
        int Toggle(ToggleSwitch t, string name, string without, int y)
        {
            Add(t, 0, y);
            Control n = Add(new Label { Text = name, AutoSize = true, Font = Ui.F(9.5f, true), ForeColor = Ui.Ink }, 48, y + 2);
            Control d = Add(Wrap(without, Ui.Ink2, 8.75f, W - 48), 48, n.Bottom + 2);
            return d.Bottom;
        }

        void BuildDonePanel()
        {
            donePanel = new Panel { Dock = DockStyle.Fill, BackColor = Ui.Page, Visible = false };
            lblDoneTitle = new Label { AutoSize = true, Font = Ui.F(22f, true), ForeColor = Ui.Water, Location = new Point(36, 40) };
            lblDoneText = new Label { AutoSize = true, MaximumSize = new Size(W, 0), Font = Ui.F(10f, false), ForeColor = Ui.Ink2, Location = new Point(38, 92) };
            donePanel.Controls.Add(lblDoneTitle);
            donePanel.Controls.Add(lblDoneText);
            right.Controls.Add(donePanel);
            donePanel.BringToFront();
        }

        Control Add(Control c, int x, int y)
        {
            c.Location = new Point(36 + x, y);
            content.Controls.Add(c);
            return c;
        }

        static Label Heading(string text)
        {
            return new Label { Text = text, AutoSize = true, Font = Ui.F(10.5f, true), ForeColor = Ui.Ink };
        }

        /// <summary>A wrapped paragraph; its height is measured, so the next section goes right below it.</summary>
        static Label Wrap(string text, Color color, float size, int width = W)
        {
            var l = new Label { Text = text, AutoSize = false, ForeColor = color, Font = Ui.F(size, false) };
            Size sz = TextRenderer.MeasureText(text, l.Font, new Size(width, 0), TextFormatFlags.WordBreak);
            l.Size = new Size(width, sz.Height + 2);
            return l;
        }

        // ---------- actions ----------

        void SetBusy(bool busy, string status)
        {
            content.Enabled = !busy;
            btnMain.Enabled = btnCancel.Enabled = lnkUninstall.Enabled = !busy;
            progress.Visible = busy;
            lnkUninstall.Visible = !busy && installed != null && !donePanel.Visible;
            lblStatus.Text = status;
        }

        int SelectedInterval()
        {
            for (int i = 0; i < choices.Length; i++) if (choices[i].Checked) return i;
            return 1;
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
            int sel = SelectedInterval();
            string interval = Agent.INTERVALS[sel];
            string intervalLabel = Agent.INTERVAL_LABELS[sel].Replace(" (zalecane)", "");
            bool shareText = tglText.Checked, shareProjects = tglProjects.Checked;
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
            content.Visible = false;
            donePanel.Visible = true;
            lnkUninstall.Visible = false;
            lblDoneTitle.Text = synced ? "Gotowe" : "Zainstalowano";
            lblDoneTitle.ForeColor = synced ? Ui.Water : Ui.Warn;
            lblDoneText.Text = (synced ? "" : "Pierwsza wysyłka się nie udała. Agent spróbuje ponownie przy następnym uruchomieniu.\n\n")
                + (last.Length > 0 ? last + ".\n\n" : "")
                + "Agent działa w tle i wysyła dane " + intervalLabel + ". Nie musisz nic więcej robić.\n\n"
                + "Raport oglądasz na stronie " + SiteLabel + ". Ustawienia zmienisz albo odinstalujesz agenta "
                + "z menu Start: „howmuchwaterdidaiused”.";
            btnCancel.Text = "Zamknij";
            btnMain.Text = "Otwórz raport";
            btnMain.Invalidate();
            btnCancel.Invalidate();
            mainAction = delegate
            {
                OpenSite("/pulpit");
                Close();
            };
        }

        void UninstallClicked()
        {
            var answer = MessageBox.Show(this,
                "Odinstalować agenta? Zadanie w Harmonogramie i folder agenta zostaną usunięte.\n\n"
                + "Dane wysłane wcześniej zostają na Twoim koncie, a klucz możesz wymienić na stronie (Konto).",
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

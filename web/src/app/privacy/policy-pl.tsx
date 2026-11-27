// Polish privacy policy. Fields to fill in before going public are marked with <Fill>.
import Link from "next/link";
import { Fill } from "./fill";

const SECTIONS = [
  ["admin", "Kto odpowiada za Twoje dane"],
  ["dane", "Jakie dane zbieramy"],
  ["cele", "Po co i na jakiej podstawie"],
  ["agent", "Agent na Twoim komputerze"],
  ["cookies", "Pliki cookie i pamięć przeglądarki"],
  ["odbiorcy", "Komu przekazujemy dane"],
  ["czas", "Jak długo przechowujemy dane"],
  ["prawa", "Twoje prawa"],
  ["bezpieczenstwo", "Bezpieczeństwo"],
  ["zmiany", "Zmiany polityki"],
];

export default function PolicyPl() {
  return (
      <article className="policy">
        <h1>Polityka prywatności</h1>
        <p className="updated">Ostatnia aktualizacja: <Fill>[data publikacji]</Fill></p>
        <p className="lead">
          Serwis howmuchwaterdidaiused pokazuje, ile pracujesz z asystentami AI, ile to kosztuje i ile wody na to
          zużywają serwery. Zbieramy tylko to, co jest do tego potrzebne. Treść Twoich promptów i nazwy projektów
          trafiają do nas wyłącznie wtedy, gdy sam na to pozwolisz.
        </p>

        <nav className="policy-toc" aria-label="Spis treści">
          <ol>{SECTIONS.map(([id, t]) => <li key={id}><a href={`#${id}`}>{t}</a></li>)}</ol>
        </nav>

        <h2 id="admin">1. Kto odpowiada za Twoje dane</h2>
        <p>
          Administratorem danych osobowych jest <Fill>[imię i nazwisko albo nazwa firmy]</Fill>,{" "}
          <Fill>[adres]</Fill>. W sprawach dotyczących danych napisz na <Fill>[adres e-mail]</Fill>.
        </p>

        <h2 id="dane">2. Jakie dane zbieramy</h2>
        <p><b>Konto.</b></p>
        <ul>
          <li>adres e-mail i nazwa wyświetlana,</li>
          <li>hasło, zapisane wyłącznie jako skrót kryptograficzny (nie znamy Twojego hasła),</li>
          <li>
            przy logowaniu przez Google albo GitHub: identyfikator konta u tego dostawcy, nazwa, adres e-mail,
            zdjęcie profilowe oraz tokeny dostępu, które dostawca przekazuje przy logowaniu.
          </li>
        </ul>
        <p><b>Sesje i bezpieczeństwo.</b></p>
        <ul>
          <li>identyfikator sesji, adres IP i informacja o przeglądarce (user agent), czas wygaśnięcia sesji,</li>
          <li>licznik prób logowania powiązany z adresem IP, służący do blokowania nadużyć,</li>
          <li>
            klucz agenta: skrót kryptograficzny oraz zaszyfrowana kopia, dzięki której instalator i kod agenta mają
            go od razu wpisanego.
          </li>
        </ul>
        <p><b>Statystyki wysyłane przez agenta</b>, dla każdego promptu:</p>
        <ul>
          <li>czas wysłania promptu i ostatniej odpowiedzi, czas pracy agenta, identyfikator sesji asystenta,</li>
          <li>użyty model, liczby tokenów, liczba użytych narzędzi, szacowany koszt i szacowane zużycie wody,</li>
          <li>liczba znaków i słów promptu, czy zawierał pytanie, wklejony tekst albo obrazek,</li>
          <li>czy prompt został przerwany, zakończył się błędem albo był poprawiany w kolejnym prompcie,</li>
          <li>nazwa projektu (folderu), w którym pracujesz, albo zamiennik „projekt 1”, „projekt 2”…,</li>
          <li>
            <b>tylko jeśli to włączysz:</b> treść promptu (pierwsze 200 znaków) oraz prawdziwe nazwy projektów.
          </li>
        </ul>
        <p>
          <b>Nie zbieramy</b> odpowiedzi asystenta, zawartości Twoich plików, kodu ani ścieżek do folderów.
        </p>
        <p>
          <b>Dane techniczne serwera.</b> Serwer, na którym działa serwis, może zapisywać standardowe dzienniki
          (adres IP, czas i adres żądania). <Fill>[uzupełnij zgodnie z hostingiem: co i jak długo jest zapisywane]</Fill>
        </p>

        <h2 id="cele">3. Po co i na jakiej podstawie</h2>
        <ul>
          <li>
            <b>Prowadzenie konta i pokazywanie raportu</b>: to usługa, z której korzystasz (art. 6 ust. 1 lit. b RODO).
          </li>
          <li>
            <b>Treść promptów i prawdziwe nazwy projektów</b>: na podstawie Twojej zgody (art. 6 ust. 1 lit. a RODO),
            którą wyrażasz, włączając te opcje w instalatorze albo w ustawieniach agenta. Możesz ją w każdej chwili
            wycofać (punkt 4).
          </li>
          <li>
            <b>Bezpieczeństwo</b>, np. limit prób logowania i dzienniki serwera: nasz prawnie uzasadniony interes
            w ochronie serwisu i kont (art. 6 ust. 1 lit. f RODO).
          </li>
        </ul>
        <p>Nie sprzedajemy danych, nie wyświetlamy reklam i nie profilujemy Cię w celach marketingowych.</p>

        <h2 id="agent">4. Agent na Twoim komputerze</h2>
        <p>
          Agent czyta lokalne zapisy rozmów z asystentem AI (na razie Claude Code), liczy z nich statystyki
          i wysyła je na Twoje konto. Anonimizacja odbywa się na Twoim komputerze, zanim cokolwiek zostanie wysłane:
          gdy treść promptów jest wyłączona, nie opuszcza ona komputera, a nazwy projektów są zamieniane na numery.
        </p>
        <p>
          Gdy wyłączysz udostępnianie treści albo nazw projektów, przy najbliższej synchronizacji agent wyśle historię
          ponownie bez tych danych i zastąpi nimi wcześniej zapisane wpisy. Agenta możesz w każdej chwili odinstalować;
          dane wysłane wcześniej zostają na koncie do jego usunięcia.
        </p>

        <h2 id="cookies">5. Pliki cookie i pamięć przeglądarki</h2>
        <ul>
          <li>używamy niezbędnego pliku cookie z identyfikatorem sesji, żeby utrzymać Cię zalogowanego, oraz jednego, który pamięta wybrany język,</li>
          <li>wybrany motyw (jasny, ciemny, jak w systemie) zapisujemy w pamięci Twojej przeglądarki,</li>
          <li>nie używamy plików cookie reklamowych ani narzędzi analitycznych firm trzecich.</li>
        </ul>

        <h2 id="odbiorcy">6. Komu przekazujemy dane</h2>
        <ul>
          <li>
            firmie hostingowej, na której serwerach działa serwis: <Fill>[nazwa dostawcy, kraj serwerów]</Fill>,
          </li>
          <li>
            Google albo GitHub, jeśli logujesz się przez nich; przetwarzają oni dane według własnych polityk
            prywatności i mogą to robić także poza Europejskim Obszarem Gospodarczym.
          </li>
        </ul>
        <p>Poza tym nie udostępniamy Twoich danych nikomu, chyba że wymaga tego prawo.</p>

        <h2 id="czas">7. Jak długo przechowujemy dane</h2>
        <ul>
          <li>dane konta i statystyki: do czasu usunięcia konta,</li>
          <li>sesje: do ich wygaśnięcia albo wylogowania,</li>
          <li>dzienniki serwera: <Fill>[okres, np. 30 dni]</Fill>.</li>
        </ul>

        <h2 id="prawa">8. Twoje prawa</h2>
        <p>
          Masz prawo dostępu do swoich danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, przeniesienia
          oraz sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie. Zgodę możesz wycofać
          w każdej chwili; nie wpływa to na zgodność z prawem wcześniejszego przetwarzania. Aby usunąć konto albo
          skorzystać z innych praw, napisz na <Fill>[adres e-mail]</Fill>.
        </p>
        <p>
          Możesz też złożyć skargę do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa).
        </p>

        <h2 id="bezpieczenstwo">9. Bezpieczeństwo</h2>
        <ul>
          <li>połączenie z serwisem i wysyłka danych przez agenta są szyfrowane (HTTPS),</li>
          <li>hasła i klucze API przechowujemy jako skróty kryptograficzne, a kopię klucza agenta w postaci zaszyfrowanej,</li>
          <li>jeśli Twój klucz agenta mógł wyciec, wygenerujesz nowy w zakładce Konto; stary przestaje działać od razu.</li>
        </ul>

        <h2 id="zmiany">10. Zmiany polityki</h2>
        <p>
          Jeśli zmienimy sposób przetwarzania danych, zaktualizujemy tę stronę i datę na górze. O istotnych zmianach
          poinformujemy zalogowanych użytkowników.
        </p>

        <p style={{ marginTop: 32 }}>
          <Link href="/about">Co znajdziesz po zalogowaniu</Link>
        </p>
      </article>
  );
}

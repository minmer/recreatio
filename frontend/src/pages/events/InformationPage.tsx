import '../../styles/information-page.css';

export function InformationPage({ eventSlug }: { eventSlug: string }) {
  const quickInfo = [
    'Termin: 17–18 kwietnia 2026',
    'Rozpoczęcie: piątek, godz. 15:30',
    'Miejsce rozpoczęcia: kościół św. Józefa, Kraków Podgórze',
    'Pierwszy dzień: przejście z Krakowa do Tyńca',
    'Nocleg: Tyniec',
    'Drugi dzień: przejście z Tyńca do Kalwarii Zebrzydowskiej',
    'Charakter pielgrzymki: Tradycja, Cisza, Liturgia',
    'Dla kogo: dla osób szukających modlitewnej, prostej i skupionej drogi'
  ];

  return (
    <div className="kal-text-layout">
      <aside className="kal-text-sidebar">
        <h1>Informacje</h1>
        <p>Najważniejsze informacje w skrócie.</p>
        <ul>
          {quickInfo.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="kal-text-actions">
          <a className="cta" href={`/#/event/${eventSlug}/zapisy`}>Zapisz się</a>
          <a className="ghost" href={`/#/event/${eventSlug}/plan`}>Zobacz plan</a>
        </div>
      </aside>

      <div className="kal-text-content">
        <section className="kal-text-section">
          <h2>Kalwaria Zebrzydowska na Wielkanoc</h2>
          <p>Piesza pielgrzymka z Krakowa do Kalwarii Zebrzydowskiej</p>
          <p>17–18 kwietnia 2026</p>
          <p>
            W piątek rozpoczynamy wspólną Mszą Świętą o godz. 15:30 w kościele św. Józefa w Krakowie na Podgórzu. Po niej
            wyruszamy pieszo w stronę Tyńca, gdzie przewidziany jest nocleg. Następnego dnia rano podejmujemy dalszą
            drogę i idziemy do Kalwarii Zebrzydowskiej.
          </p>
          <p>
            To nie jest zwykły wyjazd ani wydarzenie turystyczne. To pielgrzymka, która chce być czasem prawdziwego
            odejścia od codzienności: od pośpiechu, rozproszenia i nieustannego hałasu. Chcemy iść razem, modlić się
            razem, milczeć razem i dojść do celu z sercem bardziej otwartym na Boga.
          </p>
        </section>

        <section className="kal-text-section">
          <h2>Czym jest ta pielgrzymka?</h2>
          <p>
            Kalwaria Zebrzydowska na Wielkanoc to dwudniowa piesza pielgrzymka, która zrodziła się z bardzo prostej
            potrzeby: z pragnienia drogi, modlitwy i ciszy. Jej początki są oddolne — nie powstała jako duży projekt
            organizacyjny, ale jako odpowiedź na realne pragnienie ludzi, którzy chcieli pielgrzymować inaczej:
            spokojniej, prościej, bardziej modlitewnie.
          </p>
          <p>
            Ta pielgrzymka nie buduje się wokół rozmachu, atrakcji czy zewnętrznej oprawy. Jej centrum stanowi droga
            przeżywana w duchu skupienia, wspólnoty i liturgii. Chcemy, by było w niej miejsce zarówno na wspólną
            modlitwę i śpiew, jak i na ciszę, która pozwala usłyszeć to, co naprawdę ważne.
          </p>
          <p>
            To właśnie ten prosty charakter jest jej siłą. Nie chodzi o to, by „zaliczyć trasę”, ale by wejść w drogę
            sercem i pozwolić, by ta droga naprawdę coś w człowieku poruszyła.
          </p>
        </section>

        <section className="kal-text-section">
          <h2>Dla kogo jest ta pielgrzymka?</h2>
          <p>
            Ta pielgrzymka jest dla osób, które pragną przeżyć drogę w sposób bardziej skupiony i modlitewny. Dla tych,
            którzy chcą choć na chwilę wyjść z codziennego rytmu, odłożyć na bok nadmiar bodźców i po prostu iść — z
            intencją, z modlitwą, z wewnętrznym pokojem lub nawet z własnym niepokojem, który chcą przynieść przed Boga.
          </p>
          <p>
            Jest to propozycja dla tych, którym bliska jest prostota, wspólnota i życie Kościoła. Dla osób, które szukają
            nie tylko wydarzenia, ale także przestrzeni duchowej. Dla tych, którzy lubią tradycyjne śpiewy, liturgię,
            ciszę i drogę przeżywaną w sposób bardziej uważny.
          </p>
          <p>
            Nie trzeba mieć wielkiego doświadczenia pielgrzymkowego. Nie trzeba też „idealnie pasować” do jakiegoś
            gotowego modelu uczestnika. Wystarczy gotowość do drogi, otwartość na charakter tej pielgrzymki i chęć wejścia
            w jej rytm. Jeśli czujesz, że potrzebujesz chwili zatrzymania, modlitwy i wspólnej drogi do Matki Bożej
            Kalwaryjskiej — jest to miejsce dla Ciebie.
          </p>
        </section>

        <section className="kal-text-section">
          <h2>Jak wygląda pielgrzymka w praktyce?</h2>
          <p>
            Pielgrzymka trwa dwa dni. W piątek spotykamy się w Krakowie na wspólnej Mszy Świętej, a następnie wyruszamy
            pieszo do Tyńca. Ten pierwszy etap pozwala spokojnie wejść w drogę: zostawić za sobą codzienność,
            uporządkować serce i zacząć pielgrzymować naprawdę. Wieczorem docieramy do Tyńca, gdzie przewidziany jest
            nocleg.
          </p>
          <p>
            W sobotę rano podejmujemy drugi etap drogi. Wychodzimy z Tyńca i przez kolejne postoje zmierzamy do Kalwarii
            Zebrzydowskiej. To dzień bardziej pielgrzymkowy w klasycznym sensie: z odcinkami marszu, odpoczynkiem,
            wspólnym wysiłkiem i radością dojścia do celu. Całość kończy się wspólnym dotarciem do sanktuarium Matki Bożej
            Kalwaryjskiej.
          </p>
          <p>
            W czasie drogi towarzyszą nam wspólna modlitwa, śpiew, chwile skupienia oraz momenty ciszy. Staramy się
            zachować prosty i uporządkowany rytm pielgrzymki, tak aby wszystko prowadziło do głębszego przeżycia tej
            drogi, a nie tylko do sprawnego przejścia z punktu A do punktu B.
          </p>
        </section>

        <section className="kal-text-section">
          <h2>Co wyróżnia tę pielgrzymkę?</h2>
          <p>Nasza pielgrzymka koncentruje się wokół trzech słów: Tradycja, Cisza, Liturgia.</p>
          <div className="kal-text-detail">
            <h3>Tradycja</h3>
            <p>
              Chcemy odkrywać dawne zwyczaje Kościoła i ożywiać je na nowo — nie jako coś martwego lub jedynie
              historycznego, ale jako żywe dziedzictwo, które może prowadzić do spotkania z Chrystusem. Dlatego zależy
              nam na prostocie, tradycyjnych śpiewach, modlitwie i pewnym stylu pielgrzymowania, który nie ucieka od
              korzeni, ale próbuje je na nowo przeżyć.
            </p>
          </div>
          <div className="kal-text-detail">
            <h3>Cisza</h3>
            <p>
              Cisza na tej pielgrzymce nie jest dodatkiem. Jest jedną z najważniejszych przestrzeni tej drogi. W świecie,
              który nieustannie mówi, przypomina, powiadamia i rozprasza, chcemy odzyskać choć trochę miejsca na słuchanie
              Boga. Nie chodzi tylko o milczenie zewnętrzne, ale o wewnętrzne wyciszenie — o taką drogę, na której
              człowiek może naprawdę pobyć przed Panem.
            </p>
          </div>
          <div className="kal-text-detail">
            <h3>Liturgia</h3>
            <p>
              Liturgia zajmuje centralne miejsce w całej pielgrzymce. Jej szczytem jest Msza Święta, ale ważna jest także
              wspólna modlitwa Kościoła, śpiew i wszystko to, co pomaga przeżywać wiarę nie tylko indywidualnie, ale
              również wspólnotowo. Chcemy, by ta pielgrzymka była nie tylko ruchem w przestrzeni, ale także prawdziwym
              przeżyciem duchowym zakorzenionym w liturgii.
            </p>
          </div>
        </section>

        <section className="kal-text-section">
          <h2>Czy trzeba być „typem pielgrzyma”?</h2>
          <p>
            Nie. Nie trzeba mieć za sobą wielu pielgrzymek ani czuć się „specjalistą od takich wydarzeń”. Ta droga jest
            dla ludzi bardzo różnych — dla tych, którzy już nieraz szli na pielgrzymkę, i dla tych, którzy być może zrobią
            to po raz pierwszy.
          </p>
          <p>
            Ważniejsze od doświadczenia jest nastawienie serca. Potrzebna jest gotowość do prostszych warunków, do
            wspólnej drogi, do szacunku wobec innych uczestników i do wejścia w duchowy charakter pielgrzymki. Nie trzeba
            być idealnie przygotowanym „na wszystko”. Trzeba po prostu chcieć wyruszyć uczciwie i z dobrą wolą.
          </p>
          <p>
            Jeżeli zastanawiasz się, czy sobie poradzisz, czy odnajdziesz się w takiej formie drogi, czy to na pewno coś
            dla Ciebie — bardzo możliwe, że właśnie dlatego warto spróbować. Czasem to, czego najbardziej potrzebujemy,
            zaczyna się od jednego prostego kroku.
          </p>
        </section>

        <section className="kal-text-section">
          <h2>Jaki jest klimat tej drogi?</h2>
          <p>
            To pielgrzymka prosta, spokojna i skupiona. Nie oznacza to, że jest smutna czy zamknięta. Przeciwnie — jest w
            niej miejsce na życzliwość, wzajemną pomoc, rozmowę, wspólny śpiew i zwyczajną radość drogi. Ale wszystko to
            dzieje się bez nadmiaru i bez chaosu.
          </p>
          <p>
            Zależy nam, by pielgrzymka zachowała swój wewnętrzny porządek. By człowiek nie wracał z niej tylko zmęczony
            fizycznie, ale również umocniony duchowo. By był to czas prosty, ale głęboki. Skromny, ale piękny. Wspólny, a
            jednocześnie zostawiający miejsce na osobistą modlitwę.
          </p>
        </section>

        <section className="kal-text-section">
          <h2>Dlaczego właśnie Kalwaria Zebrzydowska?</h2>
          <p>
            Kalwaria Zebrzydowska jest miejscem szczególnym — od pokoleń związanym z modlitwą, pielgrzymowaniem i
            zawierzeniem Matce Bożej. Dla wielu osób jest to miejsce, do którego wraca się nie tylko ze względu na
            tradycję, ale także ze względu na szczególną atmosferę modlitwy i obecności Boga.
          </p>
          <p>
            Pielgrzymowanie właśnie tam, w czasie wielkanocnym, ma swój wyjątkowy sens. To czas, w którym Kościół żyje
            tajemnicą zwycięstwa Chrystusa, ale jednocześnie nie zapomina o drodze krzyża, modlitwy i zawierzenia.
            Kalwaria staje się w tym kontekście naturalnym celem drogi: miejscem, do którego się idzie nie tylko nogami,
            ale także sercem.
          </p>
        </section>

        <section className="kal-text-section">
          <h2>Ta pielgrzymka żyje dzięki ludziom</h2>
          <p>
            Od samego początku ta droga powstaje dzięki zaangażowaniu konkretnych osób. To dzieło oddolne — budowane nie
            przez wielkie struktury, ale przez ludzi, którzy chcą dać swój czas, siły, pomysły i serce. Dzięki temu
            pielgrzymka zachowuje swój prosty i prawdziwy charakter.
          </p>
          <p>
            To także zaproszenie do współodpowiedzialności. Nie tylko do udziału, ale również do współtworzenia. Jeśli
            ktoś chce pomóc, zaangażować się organizacyjnie, logistycznie, muzycznie, technicznie albo w jakikolwiek inny
            sposób — jest na to miejsce. Ta pielgrzymka naprawdę żyje tym, że ludzie biorą ją współodpowiedzialnie w swoje
            ręce.
          </p>
        </section>

        <section className="kal-text-section">
          <h2>Zaproszenie</h2>
          <p>
            Jeśli czujesz, że potrzebujesz drogi, modlitwy, ciszy i chwili prawdziwego odejścia od codzienności —
            zapraszamy Cię serdecznie. Jeśli chcesz przeżyć kilka kilometrów nie tylko jako wysiłek fizyczny, ale jako
            czas łaski, skupienia i spotkania z Bogiem — wyrusz z nami.
          </p>
          <p>
            Nie obiecujemy wygody ani „gotowego doświadczenia”. Obiecujemy drogę — prostą, prawdziwą i przeżywaną razem.
            Drogę, w której jest miejsce na modlitwę, milczenie, trud, śpiew, odpoczynek, wspólnotę i dojście do Matki
            Bożej Kalwaryjskiej.
          </p>
          <p>Zapraszamy Cię do tej drogi.</p>
          <p>17–18 kwietnia 2026</p>
          <p>Kraków – Tyniec – Kalwaria Zebrzydowska</p>
          <div className="kal-text-actions">
            <a className="cta" href={`/#/event/${eventSlug}/zapisy`}>Zapisz się</a>
            <a className="ghost" href={`/#/event/${eventSlug}/plan`}>Zobacz plan</a>
          </div>
        </section>
      </div>
    </div>
  );
}

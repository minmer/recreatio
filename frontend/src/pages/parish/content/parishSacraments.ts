export type ParishLanguage = 'pl' | 'en' | 'de';

export type SacramentContentKey =
  | 'baptism'
  | 'communion'
  | 'confirmation'
  | 'marriage'
  | 'funeral'
  | 'sick'
  | 'obit';

export type SacramentContentSection = {
  title: string;
  body: string;
};

export type SacramentInfoPage = {
  slug: string;
  title: string;
  lead: string;
  sections: SacramentContentSection[];
};

export type SacramentFaqItem = {
  question: string;
  answer: string;
};

export type SacramentFaqPage = {
  slug: string;
  title: string;
  lead: string;
  items: SacramentFaqItem[];
};

export type SacramentContentBundle = {
  generalPage: SacramentInfoPage;
  faqPage: SacramentFaqPage;
};

export type SacramentPanelMenuCopy = {
  panelTitle: string;
  overall: string;
  parish: string;
  faq: string;
  form: string;
};

const confirmationPl: SacramentContentBundle = {
  generalPage: {
    slug: 'bierzmowanie',
    title: 'Bierzmowanie - najważniejsze informacje i zasady',
    lead: 'Na tej stronie znajdują się podstawowe informacje o sakramencie bierzmowania oraz o zasadach przygotowania obowiązujących w Archidiecezji Krakowskiej i w naszej parafii. Osobno publikujemy informacje praktyczne dla kandydatów z klasy 6 oraz osobną stronę z najczęściej zadawanymi pytaniami.',
    sections: [
      {
        title: 'Czym jest bierzmowanie?',
        body: 'Bierzmowanie jest sakramentem wtajemniczenia chrześcijańskiego. Przez ten sakrament ochrzczony otrzymuje szczególną moc Ducha Świętego, aby dojrzalej żyć wiarą, odważniej wyznawać Chrystusa i bardziej świadomie należeć do Kościoła. Nie jest to jedynie religijny etap "do zaliczenia", ale ważny moment osobistego umocnienia w wierze.'
      },
      {
        title: 'Jak wygląda przygotowanie w Archidiecezji Krakowskiej?',
        body: 'W Archidiecezji Krakowskiej przygotowanie do bierzmowania jest rozłożone na kilka lat i łączy katechezę szkolną, katechezę parafialną oraz życie sakramentalne. Jako model podstawowy przyjmuje się drogę obejmującą klasy VI-VIII szkoły podstawowej. Dla uczniów klasy VI przygotowanie rozpoczyna się zwykle w drugim półroczu roku szkolnego i ma charakter wprowadzający. Sakrament bierzmowania jest udzielany najwcześniej po zakończeniu klasy VIII.'
      },
      {
        title: 'Dlaczego parafia jest tak ważna?',
        body: 'Uprzywilejowanym miejscem przygotowania do bierzmowania jest parafia zamieszkania. To właśnie we wspólnocie parafialnej kandydat uczy się modlitwy, uczestnictwa w liturgii i odpowiedzialności za swoją wiarę. Jeśli ktoś z ważnych powodów chce przygotowywać się poza parafią zamieszkania, zwykle potrzebna jest zgoda własnej parafii.'
      },
      {
        title: 'Jakie są podstawowe obowiązki kandydata?',
        body: 'Kandydat do bierzmowania powinien uczestniczyć w katechezie szkolnej, brać udział w przygotowaniu parafialnym, regularnie uczestniczyć w niedzielnej i świątecznej Mszy Świętej oraz korzystać z sakramentu pokuty i pojednania. Przygotowanie nie polega tylko na obecności, ale na realnym wzrastaniu w wierze i coraz dojrzalszym włączeniu się w życie Kościoła.'
      },
      {
        title: 'Jaką rolę pełnią rodzice?',
        body: 'Rodzice pozostają pierwszymi świadkami wiary swoich dzieci. Ich zadaniem jest wspierać młodego człowieka modlitwą, przykładem i pomocą w odpowiedzialnym przeżywaniu przygotowania. Nawet gdy kandydat podejmuje już samodzielne decyzje, rola rodziny w dojrzewaniu wiary nadal pozostaje bardzo ważna.'
      },
      {
        title: 'Jak wybiera się imię do bierzmowania?',
        body: 'Kościół zachęca, aby kandydat zachował swoje imię chrzcielne. Jeżeli wybiera nowe imię, powinno to być imię świętego patrona, którego życie może stać się inspiracją i pomocą na drodze wiary. Przy wyborze warto kierować się nie atrakcyjnością imienia, ale świadectwem życia świętego.'
      },
      {
        title: 'Kto może być świadkiem bierzmowania?',
        body: 'Najlepiej, aby świadkiem bierzmowania był chrzestny lub chrzestna, jeśli prowadzą życie zgodne z wiarą i mogą rzeczywiście towarzyszyć kandydatowi. Gdy nie jest to możliwe, można wybrać inną osobę wierzącą i praktykującą, która przyjęła już sakramenty wtajemniczenia chrześcijańskiego, ukończyła wymagany wiek i nie jest naturalnym rodzicem kandydata.'
      },
      {
        title: 'Jakie dokumenty są zwykle potrzebne?',
        body: 'W praktyce parafialnej najczęściej potrzebna jest metryka chrztu, jeśli chrzest odbył się poza parafią, w której przygotowuje się kandydat. Czasami wymagane są także dodatkowe informacje dotyczące świadka lub zgoda z parafii zamieszkania, jeśli przygotowanie odbywa się gdzie indziej. Dokładne wymagania organizacyjne są zawsze podawane przez konkretną parafię.'
      },
      {
        title: 'Ważna informacja o tej stronie',
        body: 'Na tej stronie internetowej publikujemy ogólne informacje o bierzmowaniu oraz informacje praktyczne dla kandydatów z klasy 6. Informacje dla pozostałych klas są prowadzone osobno i nie są publikowane na tej stronie.'
      }
    ]
  },
  faqPage: {
    slug: 'bierzmowanie-faq',
    title: 'FAQ o bierzmowaniu',
    lead: 'Poniżej znajdują się odpowiedzi na najczęściej zadawane pytania dotyczące bierzmowania, przygotowania do sakramentu oraz spraw organizacyjnych.',
    items: [
      {
        question: 'Czy bierzmowanie jest obowiązkowe?',
        answer: 'Kościół bardzo mocno zachęca do przyjęcia bierzmowania jako ważnego etapu wtajemniczenia chrześcijańskiego. Do sakramentu należy jednak przystępować świadomie, z wiarą i po odpowiednim przygotowaniu.'
      },
      {
        question: 'W jakim wieku przyjmuje się bierzmowanie?',
        answer: 'W Archidiecezji Krakowskiej bierzmowanie jest udzielane najwcześniej po zakończeniu klasy VIII szkoły podstawowej.'
      },
      {
        question: 'Czy przygotowanie zaczyna się już w klasie 6?',
        answer: 'Tak. W archidiecezji przyjęty jest model przygotowania obejmujący klasy VI-VIII. Klasa 6 jest etapem rozpoczęcia tej drogi.'
      },
      {
        question: 'Czy można przygotowywać się bez religii w szkole?',
        answer: 'Nie. Katecheza szkolna jest istotną częścią przygotowania do bierzmowania i nie jest zastępowana przez sam udział w spotkaniach parafialnych.'
      },
      {
        question: 'Czy przygotowanie odbywa się w parafii szkoły?',
        answer: 'Zasadniczo nie. Podstawowym miejscem przygotowania jest parafia zamieszkania. Jeśli przygotowanie ma odbywać się w innej parafii, zwykle potrzebna jest zgoda własnej parafii.'
      },
      {
        question: 'Czy trzeba wybrać nowe imię do bierzmowania?',
        answer: 'Nie. Zalecane jest zachowanie imienia chrzcielnego. Jeśli kandydat wybiera nowe imię, powinno ono należeć do świętego patrona.'
      },
      {
        question: 'Czy świadkiem bierzmowania musi być chrzestny lub chrzestna?',
        answer: 'Najlepiej, aby świadkiem był chrzestny lub chrzestna, ale nie zawsze jest to możliwe. Wtedy można wybrać inną odpowiednią osobę spełniającą warunki Kościoła.'
      },
      {
        question: 'Czy rodzice mogą być świadkami bierzmowania?',
        answer: 'Nie. Naturalni rodzice nie mogą pełnić funkcji świadka bierzmowania.'
      },
      {
        question: 'Czy trzeba dostarczyć metrykę chrztu?',
        answer: 'Tak, na etapie przygotowania do samego bierzmowania zwykle potrzebna jest metryka chrztu. Może to być ten sam dokument, który był kiedyś przyniesiony przy okazji Pierwszej Komunii Świętej, ale trzeba go złożyć ponownie, ponieważ parafia nie przechowuje dokumentów z tamtego przygotowania.'
      },
      {
        question: 'Czy samo zbieranie podpisów i obecności wystarczy?',
        answer: 'Nie. Celem przygotowania jest dojrzewanie w wierze, modlitwie i odpowiedzialności za własne życie chrześcijańskie. Wymagania organizacyjne mają pomagać w tej drodze, a nie jej zastępować.'
      },
      {
        question: 'Czy rodzice uczestniczą w przygotowaniu?',
        answer: 'Rodzice pozostają ważnym wsparciem dla kandydata, ale forma ich zaangażowania może być różna w zależności od parafii. Szczegóły organizacyjne zawsze podaje parafia prowadząca przygotowanie.'
      },
      {
        question: 'Czy dorośli też mogą przyjąć bierzmowanie?',
        answer: 'Tak. Osoby dorosłe przygotowują się jednak w innym trybie niż uczniowie szkoły podstawowej.'
      }
    ]
  }
};

const confirmationEn: SacramentContentBundle = {
  generalPage: {
    slug: 'confirmation',
    title: 'Confirmation - Key Information and Guidelines',
    lead: 'This page contains basic information about the sacrament of Confirmation and the preparation rules followed in the Archdiocese of Krakow and in our parish. We publish practical information for 6th-grade candidates separately, along with a dedicated FAQ page.',
    sections: [
      {
        title: 'What is Confirmation?',
        body: 'Confirmation is a sacrament of Christian initiation. Through this sacrament, a baptized person receives a special strength of the Holy Spirit to live the faith more maturely, profess Christ more boldly, and belong to the Church more consciously. It is not only a religious milestone to "complete", but an important moment of personal strengthening in faith.'
      },
      {
        title: 'What does preparation look like in the Archdiocese of Krakow?',
        body: 'In the Archdiocese of Krakow, preparation for Confirmation is spread over several years and combines school catechesis, parish catechesis, and sacramental life. The standard model covers grades 6-8 of primary school. For 6th-grade students, preparation usually begins in the second semester of the school year and serves as an introductory stage. Confirmation is administered no earlier than after completing grade 8.'
      },
      {
        title: 'Why is the parish so important?',
        body: 'The privileged place of preparation for Confirmation is the parish of residence. In the parish community, the candidate learns prayer, participation in the liturgy, and responsibility for personal faith. If someone, for valid reasons, wants to prepare outside the parish of residence, permission from their home parish is usually required.'
      },
      {
        title: 'What are the basic duties of a candidate?',
        body: 'A candidate for Confirmation should attend school catechesis, participate in parish preparation, regularly attend Sunday and holy day Mass, and receive the sacrament of reconciliation. Preparation is not just about attendance, but about real growth in faith and a more mature involvement in the life of the Church.'
      },
      {
        title: 'What role do parents play?',
        body: 'Parents remain the first witnesses of faith for their children. Their task is to support the young person through prayer, example, and practical help in living the preparation responsibly. Even when the candidate starts making independent decisions, the family remains very important in the maturation of faith.'
      },
      {
        title: 'How is a Confirmation name chosen?',
        body: 'The Church encourages the candidate to keep their baptismal name. If a new name is chosen, it should be the name of a saint whose life can become an inspiration and support on the path of faith. The choice should be guided not by how attractive the name sounds, but by the witness of the saint.'
      },
      {
        title: 'Who can be a Confirmation sponsor?',
        body: 'Ideally, the sponsor should be the godfather or godmother, provided they live according to the faith and can truly accompany the candidate. If this is not possible, another believing and practicing person may be chosen, provided they have received the sacraments of initiation, have reached the required age, and are not the natural parent of the candidate.'
      },
      {
        title: 'Which documents are usually required?',
        body: 'In parish practice, a baptism certificate is usually required if the baptism took place outside the parish where the candidate prepares. Sometimes additional information about the sponsor is needed, or permission from the parish of residence if preparation is done elsewhere. Exact organizational requirements are always provided by the specific parish.'
      },
      {
        title: 'Important note about this page',
        body: 'On this website we publish general information about Confirmation and practical information for 6th-grade candidates. Information for other grades is handled separately and is not published on this page.'
      }
    ]
  },
  faqPage: {
    slug: 'confirmation-faq',
    title: 'Confirmation FAQ',
    lead: 'Below you will find answers to the most frequently asked questions about Confirmation, preparation for the sacrament, and organizational matters.',
    items: [
      {
        question: 'Is Confirmation mandatory?',
        answer: 'The Church strongly encourages receiving Confirmation as an important stage of Christian initiation. However, the sacrament should be received consciously, in faith, and after proper preparation.'
      },
      {
        question: 'At what age is Confirmation received?',
        answer: 'In the Archdiocese of Krakow, Confirmation is administered no earlier than after completing grade 8 of primary school.'
      },
      {
        question: 'Does preparation begin already in grade 6?',
        answer: 'Yes. In the archdiocese, the adopted model of preparation covers grades 6-8. Grade 6 is the beginning of this path.'
      },
      {
        question: 'Can someone prepare without religion classes at school?',
        answer: 'No. School catechesis is an essential part of preparation for Confirmation and is not replaced by participation in parish meetings alone.'
      },
      {
        question: 'Does preparation take place in the parish of the school?',
        answer: 'Generally no. The basic place of preparation is the parish of residence. If preparation is to take place in another parish, permission from one’s home parish is usually required.'
      },
      {
        question: 'Do I need to choose a new Confirmation name?',
        answer: 'No. Keeping the baptismal name is recommended. If the candidate chooses a new name, it should belong to a saint patron.'
      },
      {
        question: 'Must the sponsor be the godfather or godmother?',
        answer: 'It is best if the sponsor is the godfather or godmother, but this is not always possible. In that case, another suitable person who meets Church requirements may be chosen.'
      },
      {
        question: 'Can parents be Confirmation sponsors?',
        answer: 'No. Natural parents cannot serve as Confirmation sponsors.'
      },
      {
        question: 'Is a baptism certificate required?',
        answer: 'Yes, at the stage of preparation for Confirmation itself, a baptism certificate is usually required. It may be the same document once submitted for First Communion, but it must be submitted again, because the parish does not keep documents from that earlier preparation.'
      },
      {
        question: 'Is collecting signatures and attendance enough?',
        answer: 'No. The goal of preparation is growth in faith, prayer, and responsibility for one’s Christian life. Organizational requirements are meant to support this path, not replace it.'
      },
      {
        question: 'Do parents take part in the preparation?',
        answer: 'Parents remain important support for the candidate, but the form of their involvement may vary by parish. Organizational details are always provided by the parish leading the preparation.'
      },
      {
        question: 'Can adults also receive Confirmation?',
        answer: 'Yes. Adults prepare in a different format than primary school students.'
      }
    ]
  }
};

const confirmationDe: SacramentContentBundle = {
  generalPage: {
    slug: 'firmung',
    title: 'Firmung - wichtigste Informationen und Regeln',
    lead: 'Auf dieser Seite finden Sie grundlegende Informationen über das Sakrament der Firmung sowie über die Vorbereitungsregeln, die in der Erzdiözese Krakau und in unserer Pfarrei gelten. Praktische Informationen für Kandidaten der 6. Klasse sowie eine eigene FAQ-Seite veröffentlichen wir separat.',
    sections: [
      {
        title: 'Was ist die Firmung?',
        body: 'Die Firmung ist ein Sakrament der christlichen Initiation. Durch dieses Sakrament empfängt der Getaufte eine besondere Kraft des Heiligen Geistes, um den Glauben reifer zu leben, Christus mutiger zu bekennen und bewusster zur Kirche zu gehören. Sie ist nicht nur ein religiöser Schritt, den man "abhakt", sondern ein wichtiger Moment persönlicher Stärkung im Glauben.'
      },
      {
        title: 'Wie sieht die Vorbereitung in der Erzdiözese Krakau aus?',
        body: 'In der Erzdiözese Krakau erstreckt sich die Vorbereitung auf die Firmung über mehrere Jahre und verbindet schulischen Religionsunterricht, pfarrliche Katechese und sakramentales Leben. Als Grundmodell gilt der Weg in den Klassen 6-8 der Grundschule. Für Schülerinnen und Schüler der 6. Klasse beginnt die Vorbereitung in der Regel im zweiten Halbjahr und hat einen einführenden Charakter. Die Firmung wird frühestens nach Abschluss der 8. Klasse gespendet.'
      },
      {
        title: 'Warum ist die Pfarrei so wichtig?',
        body: 'Der bevorzugte Ort der Firmvorbereitung ist die Wohnpfarrei. Gerade in der Pfarrgemeinde lernt der Kandidat Gebet, Teilnahme an der Liturgie und Verantwortung für den eigenen Glauben. Wenn jemand aus wichtigen Gründen außerhalb der Wohnpfarrei vorbereitet werden möchte, ist in der Regel die Zustimmung der eigenen Pfarrei erforderlich.'
      },
      {
        title: 'Was sind die grundlegenden Pflichten des Kandidaten?',
        body: 'Ein Firmkandidat soll am schulischen Religionsunterricht teilnehmen, sich an der pfarrlichen Vorbereitung beteiligen, regelmäßig die Sonn- und Feiertagsmesse mitfeiern und das Sakrament der Versöhnung empfangen. Vorbereitung bedeutet nicht nur Anwesenheit, sondern echtes Wachstum im Glauben und eine reifere Einbindung in das Leben der Kirche.'
      },
      {
        title: 'Welche Rolle haben die Eltern?',
        body: 'Eltern bleiben die ersten Glaubenszeugen ihrer Kinder. Ihre Aufgabe ist es, den jungen Menschen durch Gebet, Vorbild und praktische Hilfe zu unterstützen, damit die Vorbereitung verantwortungsvoll gelebt wird. Auch wenn der Kandidat bereits selbstständige Entscheidungen trifft, bleibt die Rolle der Familie für die Reifung im Glauben sehr wichtig.'
      },
      {
        title: 'Wie wählt man den Firmnamen?',
        body: 'Die Kirche ermutigt den Kandidaten, den Taufnamen beizubehalten. Wenn ein neuer Name gewählt wird, soll es der Name eines Heiligen sein, dessen Leben auf dem Glaubensweg inspirieren und helfen kann. Bei der Wahl sollte nicht die Attraktivität des Namens, sondern das Zeugnis des Heiligen entscheidend sein.'
      },
      {
        title: 'Wer kann Firmpate oder Firmpatin sein?',
        body: 'Am besten ist es, wenn der Taufpate oder die Taufpatin diese Aufgabe übernimmt, sofern er oder sie im Glauben lebt und den Kandidaten wirklich begleiten kann. Wenn das nicht möglich ist, kann eine andere gläubige und praktizierende Person gewählt werden, die die Initiationssakramente empfangen hat, das erforderliche Alter erreicht hat und nicht der leibliche Elternteil des Kandidaten ist.'
      },
      {
        title: 'Welche Dokumente werden normalerweise benötigt?',
        body: 'In der pfarrlichen Praxis wird meistens ein Taufschein benötigt, wenn die Taufe außerhalb der Pfarrei stattfand, in der sich der Kandidat vorbereitet. Manchmal werden auch zusätzliche Angaben zum Paten oder eine Zustimmung der Wohnpfarrei verlangt, wenn die Vorbereitung anderswo stattfindet. Die genauen organisatorischen Anforderungen teilt immer die jeweilige Pfarrei mit.'
      },
      {
        title: 'Wichtige Information zu dieser Seite',
        body: 'Auf dieser Website veröffentlichen wir allgemeine Informationen zur Firmung sowie praktische Informationen für Kandidaten der 6. Klasse. Informationen für andere Klassen werden separat geführt und sind auf dieser Seite nicht veröffentlicht.'
      }
    ]
  },
  faqPage: {
    slug: 'firmung-faq',
    title: 'FAQ zur Firmung',
    lead: 'Hier finden Sie Antworten auf die am häufigsten gestellten Fragen zur Firmung, zur Vorbereitung auf das Sakrament und zu organisatorischen Themen.',
    items: [
      {
        question: 'Ist die Firmung verpflichtend?',
        answer: 'Die Kirche ermutigt sehr nachdrücklich zur Firmung als wichtigem Schritt der christlichen Initiation. Zum Sakrament soll man jedoch bewusst, im Glauben und nach entsprechender Vorbereitung hinzutreten.'
      },
      {
        question: 'In welchem Alter empfängt man die Firmung?',
        answer: 'In der Erzdiözese Krakau wird die Firmung frühestens nach Abschluss der 8. Klasse der Grundschule gespendet.'
      },
      {
        question: 'Beginnt die Vorbereitung schon in der 6. Klasse?',
        answer: 'Ja. In der Erzdiözese gilt ein Vorbereitungsmodell für die Klassen 6-8. Die 6. Klasse ist der Beginn dieses Weges.'
      },
      {
        question: 'Kann man sich ohne Religionsunterricht in der Schule vorbereiten?',
        answer: 'Nein. Der schulische Religionsunterricht ist ein wesentlicher Teil der Firmvorbereitung und wird nicht allein durch die Teilnahme an Pfarrtreffen ersetzt.'
      },
      {
        question: 'Findet die Vorbereitung in der Schulpfarrei statt?',
        answer: 'Grundsätzlich nein. Der grundlegende Ort der Vorbereitung ist die Wohnpfarrei. Wenn die Vorbereitung in einer anderen Pfarrei stattfinden soll, ist in der Regel die Zustimmung der eigenen Pfarrei erforderlich.'
      },
      {
        question: 'Muss man einen neuen Firmnamen wählen?',
        answer: 'Nein. Es wird empfohlen, den Taufnamen beizubehalten. Wenn ein neuer Name gewählt wird, soll er zu einem heiligen Patron gehören.'
      },
      {
        question: 'Muss der Firmpate oder die Firmpatin der Taufpate oder die Taufpatin sein?',
        answer: 'Am besten ist es, wenn diese Rolle von Taufpate oder Taufpatin übernommen wird, aber das ist nicht immer möglich. Dann kann eine andere geeignete Person gewählt werden, die die kirchlichen Voraussetzungen erfüllt.'
      },
      {
        question: 'Können Eltern Firmpaten sein?',
        answer: 'Nein. Leibliche Eltern können die Aufgabe des Firmpaten nicht übernehmen.'
      },
      {
        question: 'Muss man einen Taufschein abgeben?',
        answer: 'Ja, in der Vorbereitung auf die eigentliche Firmung wird in der Regel ein Taufschein benötigt. Es kann derselbe Nachweis sein, der früher zur Erstkommunion vorgelegt wurde, er muss aber erneut abgegeben werden, weil die Pfarrei diese Unterlagen aus der damaligen Vorbereitung nicht aufbewahrt.'
      },
      {
        question: 'Reicht das Sammeln von Unterschriften und Anwesenheiten aus?',
        answer: 'Nein. Ziel der Vorbereitung ist das Reifen im Glauben, im Gebet und in der Verantwortung für das eigene christliche Leben. Organisatorische Anforderungen sollen diesen Weg unterstützen, nicht ersetzen.'
      },
      {
        question: 'Nehmen Eltern an der Vorbereitung teil?',
        answer: 'Eltern bleiben eine wichtige Unterstützung für den Kandidaten, aber die Form ihrer Beteiligung kann je nach Pfarrei unterschiedlich sein. Organisatorische Details nennt immer die verantwortliche Pfarrei.'
      },
      {
        question: 'Können auch Erwachsene die Firmung empfangen?',
        answer: 'Ja. Erwachsene bereiten sich jedoch in einer anderen Form vor als Schülerinnen und Schüler der Grundschule.'
      }
    ]
  }
};

export const parishSacramentContent: Record<ParishLanguage, Partial<Record<SacramentContentKey, SacramentContentBundle>>> = {
  pl: {
    confirmation: confirmationPl
  },
  en: {
    confirmation: confirmationEn
  },
  de: {
    confirmation: confirmationDe
  }
};

export const sacramentPanelMenuCopy: Record<ParishLanguage, SacramentPanelMenuCopy> = {
  pl: {
    panelTitle: 'Panel sakramentu',
    overall: 'Informacje ogólne',
    parish: 'Informacje parafii',
    faq: 'FAQ',
    form: 'Formularz kandydata'
  },
  en: {
    panelTitle: 'Sacrament panel',
    overall: 'General info',
    parish: 'Parish info',
    faq: 'FAQ',
    form: 'Candidate form'
  },
  de: {
    panelTitle: 'Sakrament-Panel',
    overall: 'Allgemeine Infos',
    parish: 'Pfarrei-Infos',
    faq: 'FAQ',
    form: 'Kandidatenformular'
  }
};

export const getParishSacramentContent = (
  language: ParishLanguage,
  key: SacramentContentKey
): SacramentContentBundle | null => {
  const direct = parishSacramentContent[language][key];
  if (direct) return direct;
  return parishSacramentContent.pl[key] ?? null;
};

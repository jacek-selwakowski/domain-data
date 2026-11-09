/* Sample domain data — mirrors the uploaded schema format.
   Embedded as a module so the demo works without any network fetch. */
export const SAMPLE_DOMAIN = [
  {
    "ResponseType": "YES_NO",
    "ResponseOptions": [
      { "ResponseCode": "T", "ResponseDescription": "Tak", "ResponseDescriptionNorm": "yes confirmed" },
      { "ResponseCode": "N", "ResponseDescription": "Nie", "ResponseDescriptionNorm": "no denied" }
    ],
    "QuestionSet": [
      {
        "QuestionCode": "KYC_PZK_003",
        "QuestionLabel": "Czy klient złożył oświadczenie o źródle pochodzenia środków?",
        "QuestionLabelNorm": "client submitted source of funds statement",
        "SurveyType": ["RETAIL", "PZK"],
        "Context": ["KYC", "PERSONAL"],
        "PersonalContext": "true",
        "SurveyCode": "KYC_PZK",
        "Notes": ["Pytanie obowiązkowe dla PZK.", "Nie edytować etykiety bez zgody Compliance."],
        "QuestionDescription": [
          { "key": "Doradca", "value": "Zapytaj o źródło środków i zaznacz odpowiedź." },
          { "key": "Infotip_PL", "value": "Oświadczenie składane jest w formie papierowej lub elektronicznej." }
        ]
      },
      {
        "QuestionCode": "KYC_SOF_011",
        "QuestionLabel": "Czy źródło środków zostało udokumentowane?",
        "QuestionLabelNorm": "source of funds documented",
        "SurveyType": ["RETAIL", "SME"],
        "Context": ["KYC", "EDD"],
        "PersonalContext": "false",
        "SurveyCode": "KYC_SOF",
        "Notes": ["W przypadku odpowiedzi N wymagana eskalacja do EDD."]
      }
    ]
  },
  {
    "ResponseType": "SINGLE",
    "ResponseOptions": [
      { "ResponseCode": "1", "ResponseDescription": "Poniżej 5 000 PLN", "ResponseDescriptionNorm": "monthly income below 5000 PLN" },
      { "ResponseCode": "2", "ResponseDescription": "5 000 - 15 000 PLN", "ResponseDescriptionNorm": "monthly income 5000 to 15000 PLN" },
      { "ResponseCode": "3", "ResponseDescription": "15 000 - 50 000 PLN", "ResponseDescriptionNorm": "monthly income 15000 to 50000 PLN" },
      { "ResponseCode": "4", "ResponseDescription": "Powyżej 50 000 PLN", "ResponseDescriptionNorm": "monthly income above 50000 PLN" },
      { "ResponseCode": "9", "ResponseDescription": "Klient odmówił odpowiedzi", "ResponseDescriptionNorm": "refused to answer" }
    ],
    "QuestionSet": [
      {
        "QuestionCode": "KYC_PZK_007",
        "QuestionLabel": "Jaki jest przeciętny miesięczny dochód netto klienta?",
        "QuestionLabelNorm": "average monthly net income",
        "SurveyType": ["RETAIL", "PZK"],
        "Context": ["PERSONAL"],
        "PersonalContext": "true",
        "SurveyCode": "KYC_PZK",
        "QuestionDescription": [
          { "key": "Doradca", "value": "Pytaj o dochód netto, po odliczeniu podatków." }
        ]
      }
    ]
  },
  {
    "ResponseType": "MULTI",
    "ResponseOptions": [
      { "ResponseCode": "CASH", "ResponseDescription": "Gotówka", "ResponseDescriptionNorm": "cash" },
      { "ResponseCode": "TRANSFER", "ResponseDescription": "Przelew krajowy", "ResponseDescriptionNorm": "domestic transfer" },
      { "ResponseCode": "FX", "ResponseDescription": "Przelew walutowy", "ResponseDescriptionNorm": "foreign currency transfer" },
      { "ResponseCode": "CARD", "ResponseDescription": "Płatności kartą", "ResponseDescriptionNorm": "card payments" },
      { "ResponseCode": "SAVINGS", "ResponseDescription": "Oszczędności", "ResponseDescriptionNorm": "savings" },
      { "ResponseCode": "OTHER", "ResponseDescription": "Inne", "ResponseDescriptionNorm": "other" }
    ],
    "QuestionSet": [
      {
        "QuestionCode": "KYC_SOF_002",
        "QuestionLabel": "Jakie są planowane źródła zasilenia rachunku?",
        "QuestionLabelNorm": "planned account funding sources",
        "SurveyType": ["RETAIL", "SME", "CORPO"],
        "Context": ["KYC"],
        "PersonalContext": "false",
        "SurveyCode": "KYC_SOF",
        "Notes": ["Można zaznaczyć wiele odpowiedzi."]
      }
    ]
  },
  {
    "ResponseType": "TEXT",
    "ResponseOptions": [],
    "QuestionSet": [
      {
        "QuestionCode": "KYC_SOF_020",
        "QuestionLabel": "Opisz szczegółowo strukturę własności klienta.",
        "QuestionLabelNorm": "describe ownership structure",
        "SurveyType": ["SME", "CORPO"],
        "Context": ["KYC", "EDD"],
        "PersonalContext": "false",
        "SurveyCode": "KYC_SOF",
        "Notes": ["Pole tekstowe. Dla klientów SME/CORPO wymagane."],
        "QuestionDescription": [
          { "key": "Doradca", "value": "Podaj udziałowców oraz procent udziałów." }
        ]
      },
      {
        "QuestionCode": "KYC_PZK_099",
        "QuestionLabel": "Dodatkowe uwagi do wywiadu.",
        "QuestionLabelNorm": "additional interview notes",
        "SurveyType": ["PZK"],
        "Context": ["CALLBACK", "PERSONAL"],
        "PersonalContext": "true",
        "SurveyCode": "KYC_PZK"
      }
    ]
  },
  {
    "ResponseType": "DICTIONARY",
    "SourceDictionary": "RDS",
    "ResponseOptions": [
      { "ResponseCode": 101, "ResponseDescription": "Umowa o pracę", "ResponseDescriptionNorm": "employment contract", "ppRespCode": 11, "ResponseStart": "2016.07.17", "ResponseEnd": "" },
      { "ResponseCode": 102, "ResponseDescription": "Umowa zlecenie", "ResponseDescriptionNorm": "mandate contract", "ppRespCode": 12, "ResponseStart": "2016.07.17", "ResponseEnd": "" },
      { "ResponseCode": 103, "ResponseDescription": "Działalność gospodarcza", "ResponseDescriptionNorm": "self-employed business activity", "ppRespCode": 13, "ResponseStart": "2016.07.17", "ResponseEnd": "2023.12.31" },
      { "ResponseCode": 104, "ResponseDescription": "Emerytura / renta", "ResponseDescriptionNorm": "pension", "ppRespCode": 14, "ResponseStart": "2016.07.17", "ResponseEnd": "" }
    ],
    "QuestionSet": [
      {
        "QuestionCode": 55,
        "QuestionLabel": "Główne źródło dochodu (słownik RDS).",
        "QuestionLabelNorm": "main income source rds dictionary",
        "Context": ["KYC"],
        "pp_code_question": 7
      }
    ]
  }
];

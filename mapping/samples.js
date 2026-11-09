// Sample datasets from the imported mapping project, kept in their original
// schema format. They are aligned into this app's persistence model on load
// (see mapping/app.js loadSample), so mapping always works on System models.
export const SAMPLE_PS = [
  {
    "count": 3,
    "ResponseType": "YES_NO",
    "ResponseOptions": [
      { "ResponseCode": "Y", "ResponseDescription": "Yes", "ResponseDescriptionNorm": "yes" },
      { "ResponseCode": "N", "ResponseDescription": "No", "ResponseDescriptionNorm": "no" }
    ],
    "QuestionSet": [
      { "QuestionCode": "KYC_PZK_001", "QuestionLabel": "Is the client a politically exposed person (PEP)?", "QuestionLabelNorm": "politically exposed person pep status", "SurveyType": ["RETAIL", "PZK"], "PersonalContext": "true", "SurveyCode": "KYC_PZK" },
      { "QuestionCode": "KYC_PZK_002", "QuestionLabel": "Is the client a family member or close associate of a PEP?", "QuestionLabelNorm": "family member close associate of pep", "SurveyType": ["RETAIL", "PZK"], "PersonalContext": "true", "SurveyCode": "KYC_PZK" },
      { "QuestionCode": "KYC_RET_010", "QuestionLabel": "Does the client act on their own behalf?", "QuestionLabelNorm": "acts on own behalf own account", "SurveyType": ["RETAIL"], "PersonalContext": "true", "SurveyCode": "KYC_RET" }
    ]
  },
  {
    "count": 2,
    "ResponseType": "SINGLE",
    "ResponseOptions": [
      { "ResponseCode": "SAL", "ResponseDescription": "Salary", "ResponseDescriptionNorm": "employment salary income" },
      { "ResponseCode": "BUS", "ResponseDescription": "Business activity", "ResponseDescriptionNorm": "own business activity income" },
      { "ResponseCode": "PEN", "ResponseDescription": "Pension", "ResponseDescriptionNorm": "retirement pension benefits" },
      { "ResponseCode": "INH", "ResponseDescription": "Inheritance", "ResponseDescriptionNorm": "inheritance donation" },
      { "ResponseCode": "SAV", "ResponseDescription": "Savings", "ResponseDescriptionNorm": "accumulated savings" },
      { "ResponseCode": "OTH", "ResponseDescription": "Other", "ResponseDescriptionNorm": "other" }
    ],
    "QuestionSet": [
      { "QuestionCode": "KYC_SOF_001", "QuestionLabel": "Primary source of funds", "QuestionLabelNorm": "source of funds origin", "SurveyType": ["RETAIL", "PZK"], "SurveyCode": "KYC_SOF", "Notes": ["Mandatory for new accounts"] },
      { "QuestionCode": "KYC_SOF_002", "QuestionLabel": "Source of wealth", "QuestionLabelNorm": "source of wealth origin", "SurveyType": ["PZK"], "SurveyCode": "KYC_SOF" }
    ]
  },
  {
    "count": 1,
    "ResponseType": "SINGLE",
    "ResponseOptions": [
      { "ResponseCode": "T1", "ResponseDescription": "Up to 10,000 PLN" },
      { "ResponseCode": "T2", "ResponseDescription": "10,001 – 50,000 PLN" },
      { "ResponseCode": "T3", "ResponseDescription": "50,001 – 200,000 PLN" },
      { "ResponseCode": "T4", "ResponseDescription": "Above 200,000 PLN" }
    ],
    "QuestionSet": [
      { "QuestionCode": "KYC_PZK_010", "QuestionLabel": "Expected monthly turnover on the account", "QuestionLabelNorm": "expected monthly account turnover", "SurveyType": ["RETAIL", "PZK"], "SurveyCode": "KYC_PZK" }
    ]
  },
  {
    "count": 1,
    "ResponseType": "MULTI",
    "ResponseOptions": [
      { "ResponseCode": "SAV", "ResponseDescription": "Savings", "ResponseDescriptionNorm": "savings deposits" },
      { "ResponseCode": "PAY", "ResponseDescription": "Everyday payments", "ResponseDescriptionNorm": "daily transactions payments" },
      { "ResponseCode": "CRD", "ResponseDescription": "Credit products", "ResponseDescriptionNorm": "loans credit" },
      { "ResponseCode": "INV", "ResponseDescription": "Investments", "ResponseDescriptionNorm": "investment" },
      { "ResponseCode": "FX", "ResponseDescription": "Foreign exchange", "ResponseDescriptionNorm": "currency exchange" },
      { "ResponseCode": "BIZ", "ResponseDescription": "Business settlements", "ResponseDescriptionNorm": "company settlements" }
    ],
    "QuestionSet": [
      { "QuestionCode": "KYC_RET_020", "QuestionLabel": "Purpose of the business relationship", "QuestionLabelNorm": "purpose of account relationship", "SurveyType": ["RETAIL"], "SurveyCode": "KYC_RET" }
    ]
  },
  {
    "count": 1,
    "ResponseType": "SINGLE",
    "ResponseOptions": [
      { "ResponseCode": "C0", "ResponseDescription": "None", "ResponseDescriptionNorm": "no cash low" },
      { "ResponseCode": "C1", "ResponseDescription": "Below 25%", "ResponseDescriptionNorm": "low cash share" },
      { "ResponseCode": "C2", "ResponseDescription": "25% – 50%", "ResponseDescriptionNorm": "medium cash share" },
      { "ResponseCode": "C3", "ResponseDescription": "Above 50%", "ResponseDescriptionNorm": "high cash share" }
    ],
    "QuestionSet": [
      { "QuestionCode": "KYC_SME_030", "QuestionLabel": "Share of cash transactions in turnover", "QuestionLabelNorm": "cash intensity share of cash", "SurveyCode": "KYC_SME" }
    ]
  },
  {
    "count": 1,
    "ResponseType": "SINGLE",
    "ResponseOptions": [
      { "ResponseCode": "EMP", "ResponseDescription": "Employed", "ResponseDescriptionNorm": "employee" },
      { "ResponseCode": "SELF", "ResponseDescription": "Self-employed", "ResponseDescriptionNorm": "entrepreneur self employed" },
      { "ResponseCode": "RET", "ResponseDescription": "Retired", "ResponseDescriptionNorm": "pensioner retired" },
      { "ResponseCode": "STU", "ResponseDescription": "Student", "ResponseDescriptionNorm": "student" },
      { "ResponseCode": "UNE", "ResponseDescription": "Unemployed", "ResponseDescriptionNorm": "not working unemployed" }
    ],
    "QuestionSet": [
      { "QuestionCode": "KYC_RET_070", "QuestionLabel": "Employment status", "QuestionLabelNorm": "professional employment status", "SurveyType": ["RETAIL"], "SurveyCode": "KYC_RET" }
    ]
  },
  {
    "count": 3,
    "ResponseType": "TEXT",
    "ResponseOptions": [],
    "QuestionSet": [
      { "QuestionCode": "KYC_PZK_050", "QuestionLabel": "Employer name", "QuestionLabelNorm": "employer name", "SurveyType": ["RETAIL", "PZK"], "SurveyCode": "KYC_PZK" },
      { "QuestionCode": "KYC_PZK_051", "QuestionLabel": "Occupation description", "QuestionLabelNorm": "occupation job title", "SurveyType": ["RETAIL", "PZK"], "SurveyCode": "KYC_PZK" },
      { "QuestionCode": "KYC_CORPO_052", "QuestionLabel": "Description of business activity", "QuestionLabelNorm": "business activity description", "SurveyCode": "KYC_CORPO" }
    ]
  },
  {
    "count": 1,
    "ResponseType": "PERSON_KYC",
    "ResponseOptions": [],
    "QuestionSet": [
      { "QuestionCode": "KYC_PZK_061", "QuestionLabel": "Proxy / attorney identification", "QuestionLabelNorm": "authorized representative proxy", "SurveyType": ["PZK"], "SurveyCode": "KYC_PZK" }
    ]
  }
];

export const SAMPLE_RDS = [
  {
    "count": 4,
    "ResponseType": "YES_NO",
    "ResponseOptions": [
      { "ResponseCode": 1, "ResponseDescription": "Tak / Yes", "ResponseDescriptionNorm": "yes", "ppRespCode": "T", "ResponseStart": "2016.07.17", "ResponseEnd": "" },
      { "ResponseCode": 0, "ResponseDescription": "Nie / No", "ResponseDescriptionNorm": "no", "ppRespCode": "N", "ResponseStart": "2016.07.17", "ResponseEnd": "" }
    ],
    "QuestionSet": [
      { "QuestionCode": "1001", "QuestionLabel": "Client holds a prominent public function (PEP)", "QuestionLabelNorm": "politically exposed person pep status", "pp_code_question": 501 },
      { "QuestionCode": "1002", "QuestionLabel": "Client is related to a PEP", "QuestionLabelNorm": "family member close associate of pep", "pp_code_question": 502 },
      { "QuestionCode": "1003", "QuestionLabel": "Transactions on behalf of a third party", "QuestionLabelNorm": "acts on behalf of third party", "pp_code_question": 503 },
      { "QuestionCode": "1004", "QuestionLabel": "Uses cash in high volumes", "QuestionLabelNorm": "cash intensive high cash usage", "pp_code_question": 504 }
    ]
  },
  {
    "count": 1,
    "ResponseType": "MULTI",
    "ResponseOptions": [
      { "ResponseCode": 10, "ResponseDescription": "Employment income", "ResponseDescriptionNorm": "employment salary income", "ppRespCode": "E", "ResponseStart": "2016.07.17", "ResponseEnd": "" },
      { "ResponseCode": 11, "ResponseDescription": "Entrepreneurship", "ResponseDescriptionNorm": "own business activity income", "ppRespCode": "B", "ResponseStart": "2016.07.17", "ResponseEnd": "" },
      { "ResponseCode": 12, "ResponseDescription": "Retirement benefits", "ResponseDescriptionNorm": "retirement pension benefits", "ppRespCode": "R", "ResponseStart": "2016.07.17", "ResponseEnd": "" },
      { "ResponseCode": 13, "ResponseDescription": "Inheritance or gift", "ResponseDescriptionNorm": "inheritance donation", "ppRespCode": "I", "ResponseStart": "2016.07.17", "ResponseEnd": "" },
      { "ResponseCode": 14, "ResponseDescription": "Sale of property", "ResponseDescriptionNorm": "sale of real estate assets", "ppRespCode": "S", "ResponseStart": "2018.01.01", "ResponseEnd": "" },
      { "ResponseCode": 15, "ResponseDescription": "Capital gains", "ResponseDescriptionNorm": "investment returns", "ppRespCode": "C", "ResponseStart": "2018.01.01", "ResponseEnd": "" },
      { "ResponseCode": 19, "ResponseDescription": "Other source", "ResponseDescriptionNorm": "other", "ppRespCode": "O", "ResponseStart": "2016.07.17", "ResponseEnd": "" }
    ],
    "QuestionSet": [
      { "QuestionCode": "2001", "QuestionLabel": "Origin of funds deposited", "QuestionLabelNorm": "source of funds origin", "pp_code_question": 610 }
    ]
  },
  {
    "count": 1,
    "ResponseType": "SINGLE",
    "ResponseOptions": [
      { "ResponseCode": 1, "ResponseDescription": "< 5,000", "ppRespCode": "A", "ResponseStart": "2016.07.17", "ResponseEnd": "" },
      { "ResponseCode": 2, "ResponseDescription": "5,000 – 25,000", "ppRespCode": "B", "ResponseStart": "2016.07.17", "ResponseEnd": "" },
      { "ResponseCode": 3, "ResponseDescription": "25,000 – 100,000", "ppRespCode": "C", "ResponseStart": "2016.07.17", "ResponseEnd": "" },
      { "ResponseCode": 4, "ResponseDescription": "100,000 – 500,000", "ppRespCode": "D", "ResponseStart": "2016.07.17", "ResponseEnd": "" },
      { "ResponseCode": 5, "ResponseDescription": "> 500,000", "ppRespCode": "E", "ResponseStart": "2016.07.17", "ResponseEnd": "" }
    ],
    "QuestionSet": [
      { "QuestionCode": "2010", "QuestionLabel": "Planned monthly inflows", "QuestionLabelNorm": "expected monthly account turnover inflows", "pp_code_question": 620 },
      { "QuestionCode": "2011", "QuestionLabel": "Planned monthly outflows", "QuestionLabelNorm": "expected monthly account turnover outflows", "pp_code_question": 621 }
    ]
  },
  {
    "count": 1,
    "ResponseType": "MULTI",
    "ResponseOptions": [
      { "ResponseCode": 31, "ResponseDescription": "Deposits and savings", "ResponseDescriptionNorm": "savings deposits", "ppRespCode": "31" },
      { "ResponseCode": 32, "ResponseDescription": "Current account transactions", "ResponseDescriptionNorm": "daily transactions payments", "ppRespCode": "32" },
      { "ResponseCode": 33, "ResponseDescription": "Lending", "ResponseDescriptionNorm": "loans credit", "ppRespCode": "33" },
      { "ResponseCode": 34, "ResponseDescription": "Investment products", "ResponseDescriptionNorm": "investment", "ppRespCode": "34" },
      { "ResponseCode": 35, "ResponseDescription": "Trade finance", "ResponseDescriptionNorm": "company settlements trade", "ppRespCode": "35" },
      { "ResponseCode": 36, "ResponseDescription": "Currency operations", "ResponseDescriptionNorm": "currency exchange", "ppRespCode": "36", "ResponseStart": "2016.07.17", "ResponseEnd": "2022.12.31" }
    ],
    "QuestionSet": [
      { "QuestionCode": "2020", "QuestionLabel": "Intended use of products", "QuestionLabelNorm": "purpose of account relationship", "pp_code_question": 630 }
    ]
  },
  {
    "count": 1,
    "ResponseType": "SINGLE",
    "ResponseOptions": [
      { "ResponseCode": 1, "ResponseDescription": "Employee", "ResponseDescriptionNorm": "employee" },
      { "ResponseCode": 2, "ResponseDescription": "Business owner", "ResponseDescriptionNorm": "entrepreneur self employed" },
      { "ResponseCode": 3, "ResponseDescription": "Pensioner", "ResponseDescriptionNorm": "pensioner retired" },
      { "ResponseCode": 4, "ResponseDescription": "Not economically active", "ResponseDescriptionNorm": "student unemployed not working" }
    ],
    "QuestionSet": [
      { "QuestionCode": "2070", "QuestionLabel": "Professional status", "QuestionLabelNorm": "professional employment status", "pp_code_question": 670 }
    ]
  },
  {
    "count": 1,
    "ResponseType": "SINGLE",
    "ResponseOptions": [
      { "ResponseCode": 1, "ResponseDescription": "Individual business", "ResponseDescriptionNorm": "sole trader" },
      { "ResponseCode": 2, "ResponseDescription": "Capital company", "ResponseDescriptionNorm": "limited liability company joint stock company" },
      { "ResponseCode": 3, "ResponseDescription": "Personal partnership", "ResponseDescriptionNorm": "partnership" },
      { "ResponseCode": 4, "ResponseDescription": "Non-profit organisation", "ResponseDescriptionNorm": "foundation association cooperative" }
    ],
    "QuestionSet": [
      { "QuestionCode": "2080", "QuestionLabel": "Company type", "QuestionLabelNorm": "entity legal form", "pp_code_question": 680 }
    ]
  },
  {
    "count": 3,
    "ResponseType": "TEXT",
    "ResponseOptions": [],
    "QuestionSet": [
      { "QuestionCode": "3001", "QuestionLabel": "Workplace", "QuestionLabelNorm": "employer name", "pp_code_question": 701 },
      { "QuestionCode": "3002", "QuestionLabel": "Position held", "QuestionLabelNorm": "occupation job title", "pp_code_question": 702 },
      { "QuestionCode": "3003", "QuestionLabel": "Industry / PKD activity", "QuestionLabelNorm": "business activity description industry", "pp_code_question": 703 }
    ]
  }
];

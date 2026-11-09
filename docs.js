/* ============================================================================
   Persistence model documentation — rendered in the "Persistence model" section
   ============================================================================ */
import { h, esc } from './ui.js';

const COLLECTIONS = [
  {
    name: 'System',
    id: 'sys_xxxxxxxx',
    icon: 'server',
    desc: 'System data name structure: (name, id). Root of every uploaded domain model.',
    props: [
      ['id', 'technical unique ID'],
      ['name', 'from the upload text input'],
      ['createdAt / updatedAt', 'timestamps'],
      ['sourceFileName', 'imported file name'],
    ],
  },
  {
    name: 'ResponseType enum',
    id: 'rt_xxxxxxxx',
    icon: 'shapes',
    desc: 'Dedicated (name, id) structure for the ResponseType enum. Seeded from the schema; unknown values in a file are added as new entries.',
    props: [
      ['id', 'technical unique ID'],
      ['name', 'enum value, e.g. SINGLE, YES_NO'],
      ['isSeed', 'came from the schema or was discovered'],
    ],
  },
  {
    name: 'ProcessContext',
    id: 'pc_xxxxxxxx',
    icon: 'workflow',
    desc: 'Dedicated (name, id) structure for the ProcessContext enum (ONBOARDING, KYC, EDD, …).',
    props: [
      ['id', 'technical unique ID'],
      ['name', 'enum value'],
    ],
  },
  {
    name: 'SurveyType enum',
    id: 'st_xxxxxxxx',
    icon: 'segments',
    desc: 'SurveyType values with unique name and relation to the System.',
    props: [
      ['id', 'technical unique ID'],
      ['name', 'unique enum name, e.g. RETAIL, PZK'],
      ['systemId', 'relation to the System'],
    ],
  },
  {
    name: 'Context enum',
    id: 'ctx_xxxxxxxx',
    icon: 'git-branch',
    desc: 'Context values with unique name and relation to the System.',
    props: [
      ['id', 'technical unique ID'],
      ['name', 'unique enum name, e.g. KYC, PERSONAL'],
      ['systemId', 'relation to the System'],
    ],
  },
  {
    name: 'QuestionSet',
    id: 'qs_xxxxxxxx',
    icon: 'layers',
    desc: 'Every group appearing in the file gets a unique ID and is persisted with its System id. Owns the ResponseOptions items.',
    props: [
      ['id', 'technical unique ID'],
      ['systemId', 'relation to the System'],
      ['responseTypeId', 'relation to ResponseType by id'],
      ['index', 'order in the file'],
      ['optionCount / questionCount', 'derived counters'],
      ['restJson', 'all other group properties as one JSON string'],
    ],
  },
  {
    name: 'Question',
    id: 'q_xxxxxxxx',
    icon: 'list-checks',
    desc: 'Question set item with designated properties; everything else is kept as one JSON string property.',
    props: [
      ['id', 'technical unique ID'],
      ['QuestionCode', 'designated'],
      ['QuestionLabel', 'designated'],
      ['QuestionLabelNorm', 'designated'],
      ['SurveyCode', 'designated'],
      ['questionSetId', 'relation to its QuestionSet'],
      ['PersonalContext / Notes / QuestionDescription / pp_code_question', 'designated extras'],
      ['restJson', 'one JSON string property for the rest'],
    ],
  },
  {
    name: 'QuestionOption',
    id: 'opt_xxxxxxxx',
    icon: 'circle-dot',
    desc: 'ResponseOptions items persisted with the QuestionSetId of the set that contains them.',
    props: [
      ['id', 'technical unique ID'],
      ['questionSetId', 'assigned QuestionSet id'],
      ['ResponseCode', 'designated'],
      ['ResponseDescription', 'designated'],
      ['ResponseDescriptionNorm', 'designated'],
      ['restJson', 'one JSON string property (ppRespCode, ResponseStart, ResponseEnd, …)'],
    ],
  },
  {
    name: 'Question ↔ SurveyTypes',
    id: 'qst_xxxxxxxx',
    icon: 'link',
    desc: 'Relation table: question → SurveyType ids.',
    props: [
      ['id', 'technical unique ID'],
      ['questionId', 'relation to Question'],
      ['surveyTypeId', 'relation to SurveyType'],
    ],
  },
  {
    name: 'Question ↔ Contexts',
    id: 'qctx_xxxxxxxx',
    icon: 'link',
    desc: 'Relation table: question → Context ids.',
    props: [
      ['id', 'technical unique ID'],
      ['questionId', 'relation to Question'],
      ['contextId', 'relation to Context'],
    ],
  },
  {
    name: 'Question ↔ ResponseType',
    id: 'qrt_xxxxxxxx',
    icon: 'link',
    desc: 'Relation table: question → ResponseType id (derived from its QuestionSet).',
    props: [
      ['id', 'technical unique ID'],
      ['questionId', 'relation to Question'],
      ['responseTypeId', 'relation to ResponseType'],
    ],
  },
];

export function renderDocs() {
  const root = document.getElementById('docsBody');
  root.innerHTML = `
    <div class="card p-5 text-sm text-gray-600 leading-relaxed">
      The uploaded JSON (array of ResponseType / ResponseOptions / QuestionSet groups) is normalized into the dedicated
      collections below. Each item in every persistent collection carries its own technical unique ID, and relations are
      stored by id — never by name. Storage: Puter.js key-value cloud database scoped to the signed-in user
      (index key <span class="mono">sds.systems</span>, one record per system <span class="mono">sds.system.&lt;id&gt;</span>).
    </div>
    <div class="grid md:grid-cols-2 gap-4">
      ${COLLECTIONS.map(c => `
        <div class="card p-5">
          <div class="flex items-center gap-2.5 mb-2">
            <span class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center"><i data-lucide="${c.icon}" class="w-4 h-4"></i></span>
            <div>
              <h3 class="font-semibold text-sm">${esc(c.name)}</h3>
              <div class="mono">${esc(c.id)}</div>
            </div>
          </div>
          <p class="text-xs text-gray-500 leading-relaxed mb-3">${esc(c.desc)}</p>
          <table class="w-full text-xs">
            <tbody class="divide-y divide-gray-50">
              ${c.props.map(([p, d]) => `<tr><td class="py-1.5 pr-3 font-mono text-gray-700 align-top whitespace-nowrap">${esc(p)}</td><td class="py-1.5 text-gray-500">${esc(d)}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>`).join('')}
    </div>`;
}

import React, { useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRobot,
  faBolt,
  faPlus,
  faTrash,
  faArrowUp,
  faArrowDown,
  faPlay,
  faCopy,
  faDownload,
  faUpload,
  faCircleCheck,
  faCircleNotch,
  faSave,
  faBullseye,
  faListOl,
  faFlagCheckered,
  faWandMagicSparkles,
  faRotateRight,
  faSliders,
  faArrowLeft,
  faArrowRight,
} from '@fortawesome/free-solid-svg-icons';
import { useLang } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { usePromptRunner } from '../hooks/usePromptRunner';
import PromptStudio from './PromptStudio';

const AGENTS_KEY = 'aiSocialAgents';

// Preset agents — each step is a real LLM call. Variables:
//   {{input}} = what the user types before running
//   {{prev}}  = output of the previous step
// Prompts are short and structured so small local models (3B) stay on track.
const PRESET_AGENTS = [
  {
    id: 'preset-sales-caption',
    builtin: true,
    emoji: '🎯',
    name: 'Caption bán hàng',
    desc: 'Phân tích sản phẩm → hook → caption hoàn chỉnh kèm hashtag.',
    language: 'vi',
    steps: [
      { title: 'Phân tích sản phẩm', prompt: 'Phân tích ngắn gọn về: {{input}}.\nLiệt kê: đối tượng khách hàng mục tiêu, 3 lợi ích chính, 1 cảm xúc chủ đạo. Trả lời gọn trong 6 dòng, không markdown.' },
      { title: 'Viết 3 hook', prompt: 'Dựa vào phân tích sau:\n{{prev}}\n\nViết 3 câu mở đầu (hook) mỗi câu dưới 15 từ cho bài đăng về: {{input}}. Mỗi hook một dòng, đánh số 1., 2., 3. Chỉ trả về 3 dòng.' },
      { title: 'Caption hoàn chỉnh', prompt: 'Dùng phân tích và hook trong nội dung sau:\n{{prev}}\n\nViết 1 caption Facebook hoàn chỉnh (80-120 từ) cho: {{input}}. Giọng văn gần gũi, có CTA, cuối cùng thêm 5 hashtag tiếng Việt. Chỉ trả về caption.' },
    ],
  },
  {
    id: 'preset-week-plan',
    builtin: true,
    emoji: '📅',
    name: 'Kế hoạch nội dung tuần',
    desc: 'Chủ đề tuần → chọn 3 ý tốt nhất → lịch đăng 7 ngày.',
    language: 'vi',
    steps: [
      { title: 'Gợi ý chủ đề', prompt: 'Gợi ý 5 chủ đề nội dung cho tuần này về: {{input}}. Mỗi dòng gồm: chủ đề - lý do ngắn gọn. Chỉ 5 dòng.' },
      { title: 'Chọn và phát triển', prompt: 'Chọn 3 chủ đề hấp dẫn nhất từ danh sách sau:\n{{prev}}\n\nVới mỗi chủ đề viết: định dạng bài (video/ảnh/carousel), thời điểm đăng tốt nhất trong ngày, CTA phù hợp. Mỗi chủ đề 3 dòng.' },
      { title: 'Lịch 7 ngày', prompt: 'Từ kế hoạch sau, viết lịch đăng 7 ngày cho: {{input}}.\n{{prev}}\n\nĐịnh dạng mỗi dòng: Thứ X - chủ đề - định dạng - giờ đăng. Chỉ trả về 7 dòng lịch.' },
    ],
  },
  {
    id: 'preset-comment-reply',
    builtin: true,
    emoji: '💬',
    name: 'Trả lời bình luận',
    desc: 'Phân loại cảm xúc bình luận → 3 phương án trả lời.',
    language: 'vi',
    steps: [
      { title: 'Phân loại bình luận', prompt: 'Phân loại bình luận sau (thiện chí / thắc mắc / phàn nàn / spam) và nêu cảm xúc của người viết trong 2 dòng:\n"{{input}}"' },
      { title: 'Soạn 3 phản hồi', prompt: 'Soạn 3 phương án trả lời cho bình luận đã phân loại bên dưới. Giọng thân thiện, chuyên nghiệp, mỗi phương án dưới 40 từ, đánh số 1., 2., 3.:\n{{prev}}' },
    ],
  },
  {
    id: 'preset-storyboard',
    builtin: true,
    emoji: '🎬',
    name: 'Storyboard video 30s',
    desc: 'Concept → 5 cảnh chi tiết → caption đăng kèm hashtag.',
    language: 'vi',
    steps: [
      { title: 'Concept', prompt: 'Đề xuất concept video 30 giây cho: {{input}}. Nêu: thông điệp chính, đối tượng xem, cảm xúc chủ đạo. Gọn trong 5 dòng.' },
      { title: 'Chia 5 cảnh', prompt: 'Chia concept sau thành 5 cảnh. Mỗi cảnh 3 dòng: thời lượng (giây), mô tả hình ảnh, lời thoại hoặc chữ trên màn hình:\n{{prev}}' },
      { title: 'Caption đăng bài', prompt: 'Viết caption bài đăng kèm 5 hashtag cho video có các cảnh sau:\n{{prev}}\n\nChỉ trả về caption + hashtag.' },
    ],
  },
  {
    id: 'preset-brand-audit',
    builtin: true,
    emoji: '🔍',
    name: 'Đánh giá thương hiệu',
    desc: 'Điểm mạnh/yếu → insight khách hàng → checklist 2 tuần.',
    language: 'vi',
    steps: [
      { title: 'Đánh giá nhanh', prompt: 'Đánh giá nhanh điểm mạnh và điểm yếu khi làm nội dung mạng xã hội cho: {{input}}. Trả lời trong 6 dòng.' },
      { title: 'Insight và ý tưởng', prompt: 'Từ đánh giá sau, nêu 3 insight về khách hàng và 3 ý tưởng nội dung đột phá. Mỗi ý 1 dòng:\n{{prev}}' },
      { title: 'Kế hoạch 2 tuần', prompt: 'Chốt kế hoạch hành động 2 tuần dựa trên:\n{{prev}}\n\nTrả về dạng checklist, mỗi việc 1 dòng, bắt đầu bằng "- [ ]".' },
    ],
  },
];

// Closed-loop wizard: goal → steps → test run → finish. The rail shows where
// the user is; Back/Next keep the flow contained (no jumping between panels).
const WIZ_STEPS = [
  { key: 'goal', icon: faBullseye, vi: 'Mục tiêu', en: 'Goal' },
  { key: 'steps', icon: faListOl, vi: 'Kịch bản', en: 'Steps' },
  { key: 'run', icon: faPlay, vi: 'Chạy thử', en: 'Test run' },
  { key: 'done', icon: faFlagCheckered, vi: 'Hoàn tất', en: 'Finish' },
];

const LANG_STRINGS = {
  vi: {
    tabs: { agent: 'Agent Builder', quick: 'Prompt nhanh' },
    modeWizard: 'Chế độ wizard',
    modeAdvanced: 'Giao diện nâng cao',
    // Wizard rail + navigation
    next: 'Tiếp theo',
    back: 'Quay lại',
    saveAndContinue: 'Lưu & chạy thử',
    // Step 1 — goal
    goalTitle: '1. Chọn mục tiêu cho agent',
    goalHint: 'Chọn một kịch bản mẫu để bắt đầu nhanh, hoặc tự tạo từ đầu. Bạn sẽ chỉnh được từng bước ở phần sau.',
    blankGoal: 'Tự tạo từ đầu',
    blankGoalDesc: 'Agent trống, tự viết kịch bản các bước.',
    detailsLabel: 'Thông tin agent',
    // Step 2 — steps
    stepsTitle: 'Kịch bản các bước',
    addStep: 'Thêm bước',
    stepPromptPlaceholder: 'Nội dung prompt của bước này…\nDùng {{input}} cho đề bài và {{prev}} cho kết quả bước trước.',
    varInput: 'đề bài',
    varPrev: 'kết quả bước trước',
    noVarsWarn: 'Bước này chưa dùng {{input}} hoặc {{prev}} — model sẽ thiếu ngữ cảnh.',
    stepNeedsPrompt: 'Bước {n} chưa có nội dung prompt.',
    // Step 3 — run
    runTitle: 'Chạy thử agent',
    runIntro: 'Nhập đề bài rồi chạy thử toàn bộ agent. Kết quả của mỗi bước tự động truyền sang bước sau.',
    runInputPlaceholder: 'Nhập chủ đề / sản phẩm / tình huống cho agent xử lý…',
    runButton: 'Chạy agent',
    running: 'Đang chạy…',
    cancelButton: 'Huỷ',
    retryStep: 'Chạy lại bước này',
    stepPending: 'Chờ',
    stepDone: 'Xong',
    stepFailed: 'Lỗi',
    totalTime: 'Tổng thời gian',
    copyTranscript: 'Copy toàn bộ kết quả',
    copied: 'Đã copy vào clipboard',
    // Step 4 — finish
    finishTitle: 'Agent đã sẵn sàng',
    savedOk: 'Đã lưu vào thư viện agents của bạn.',
    notSaved: 'Agent mẫu chưa được lưu vĩnh viễn — bấm bên dưới để giữ lại bản đã chỉnh.',
    saveNow: 'Lưu thành agent của tôi',
    curlTitle: 'Chạy bằng API (tuỳ chọn)',
    curlHint: 'Agent chạy được cả qua HTTP — dán lệnh này vào terminal trên server:',
    rerun: 'Chạy đề bài khác',
    editSteps: 'Sửa kịch bản',
    another: 'Tạo agent khác',
    // Library management (advanced + wizard)
    agentsTitle: 'Agents của bạn',
    newAgent: 'Tạo agent mới',
    importAgent: 'Nhập JSON',
    exportAgent: 'Xuất JSON',
    saveAgent: 'Lưu agent',
    saveAsCopy: 'Lưu thành agent của tôi',
    deleteAgent: 'Xoá',
    builtinHint: 'Agent mẫu — nhân bản để chỉnh sửa vĩnh viễn',
    editorName: 'Tên agent',
    editorDesc: 'Mô tả',
    editorLang: 'Ngôn ngữ đầu ra',
    saved: 'Đã lưu agent',
    deleted: 'Đã xoá agent',
    imported: 'Đã nhập agent',
    importError: 'File JSON không hợp lệ',
    emptySteps: 'Agent cần ít nhất 1 bước. Thêm bước ở panel giữa.',
    needInput: 'Hãy nhập nội dung trước khi chạy',
    needName: 'Agent phải có tên',
    cancelNotice: 'Đã huỷ chạy agent.',
    selectHint: 'Chọn một agent ở bên trái, nhập đề bài rồi bấm Chạy agent.',
    stepsUnit: 'bước',
    offlineNote: 'Cần API server đang chạy để agent hoạt động (xem trạng thái ở tab Prompt nhanh).',
  },
  en: {
    tabs: { agent: 'Agent Builder', quick: 'Quick prompt' },
    modeWizard: 'Wizard mode',
    modeAdvanced: 'Advanced studio',
    next: 'Next',
    back: 'Back',
    saveAndContinue: 'Save & test',
    goalTitle: '1. Pick the agent goal',
    goalHint: 'Pick a preset to start fast, or build from scratch. You can fine-tune every step next.',
    blankGoal: 'Start from scratch',
    blankGoalDesc: 'Empty agent, write your own step pipeline.',
    detailsLabel: 'Agent details',
    stepsTitle: 'Steps',
    addStep: 'Add step',
    stepPromptPlaceholder: 'Prompt for this step…\nUse {{input}} for the task and {{prev}} for the previous step result.',
    varInput: 'task input',
    varPrev: 'previous result',
    noVarsWarn: 'This step uses neither {{input}} nor {{prev}} — the model will lack context.',
    stepNeedsPrompt: 'Step {n} has no prompt yet.',
    runTitle: 'Test run the agent',
    runIntro: 'Enter the task and run the whole agent. Each step output is fed into the next step automatically.',
    runInputPlaceholder: 'Enter the topic / product / situation for the agent…',
    runButton: 'Run agent',
    running: 'Running…',
    cancelButton: 'Cancel',
    retryStep: 'Retry this step',
    stepPending: 'Queued',
    stepDone: 'Done',
    stepFailed: 'Failed',
    totalTime: 'Total time',
    copyTranscript: 'Copy full transcript',
    copied: 'Copied to clipboard',
    finishTitle: 'Your agent is ready',
    savedOk: 'Saved to your agent library.',
    notSaved: 'The preset is not persisted yet — save it to keep your edits.',
    saveNow: 'Save as my agent',
    curlTitle: 'Run via API (optional)',
    curlHint: 'Agents also run over HTTP — paste this into a terminal on the server:',
    rerun: 'Run with a different task',
    editSteps: 'Edit the steps',
    another: 'Create another agent',
    agentsTitle: 'Your agents',
    newAgent: 'New agent',
    importAgent: 'Import JSON',
    exportAgent: 'Export JSON',
    saveAgent: 'Save agent',
    saveAsCopy: 'Save as my agent',
    deleteAgent: 'Delete',
    builtinHint: 'Preset agent — duplicate it to persist edits',
    editorName: 'Agent name',
    editorDesc: 'Description',
    editorLang: 'Output language',
    saved: 'Agent saved',
    deleted: 'Agent deleted',
    imported: 'Agent imported',
    importError: 'Invalid JSON file',
    emptySteps: 'An agent needs at least 1 step. Add one in the middle panel.',
    needInput: 'Enter the task first',
    needName: 'The agent needs a name',
    cancelNotice: 'Agent run cancelled.',
    selectHint: 'Pick an agent on the left, type the task, then press Run agent.',
    stepsUnit: 'steps',
    offlineNote: 'The API server must be running for agents to work (see status in the Quick prompt tab).',
  },
};

function loadUserAgents() {
  try {
    const raw = JSON.parse(localStorage.getItem(AGENTS_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((a) => a && a.id && Array.isArray(a.steps)) : [];
  } catch { return []; }
}

function fillTemplate(template, vars) {
  return String(template || '')
    .split('{{input}}').join(vars.input)
    .split('{{prev}}').join(vars.prev)
    .split('{{agent}}').join(vars.agentName || '');
}

const AgentStudio = ({ user }) => {
  const [lang] = useLang();
  const T = LANG_STRINGS[lang];
  const [tab, setTab] = useState('agent');
  const [mode, setMode] = useState('wizard'); // 'wizard' (default) | 'advanced'

  const [userAgents, setUserAgents] = useState(loadUserAgents);
  const [agents, setAgents] = useState(() => [...loadUserAgents(), ...PRESET_AGENTS]);
  const [selectedId, setSelectedId] = useState(PRESET_AGENTS[0].id);
  const [draft, setDraft] = useState(() => ({ ...PRESET_AGENTS[0], steps: PRESET_AGENTS[0].steps.map((s) => ({ ...s })) }));
  const [notice, setNotice] = useState('');
  const [toast, setToast] = useState('');

  const [wStep, setWStep] = useState(0);

  const [input, setInput] = useState('');
  const [stepStates, setStepStates] = useState([]); // [{status, text, ms}]
  const [totalMs, setTotalMs] = useState(0);
  const [running, setRunning] = useState(false);
  const runner = usePromptRunner();
  const cancelledRef = useRef(false);
  const importRef = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2200);
  };

  const persistAgents = (list) => {
    setUserAgents(list);
    setAgents([...list, ...PRESET_AGENTS]);
    try { localStorage.setItem(AGENTS_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  };

  const selectAgent = (agent) => {
    setSelectedId(agent.id);
    setDraft(JSON.parse(JSON.stringify(agent)));
    setStepStates([]);
    setTotalMs(0);
    setNotice('');
  };

  const startBlank = () => {
    const blank = {
      id: `agent-${Date.now()}`,
      builtin: false,
      emoji: '🤖',
      name: lang === 'vi' ? 'Agent mới' : 'New agent',
      desc: '',
      language: lang,
      steps: [{ title: lang === 'vi' ? 'Bước 1' : 'Step 1', prompt: '' }],
    };
    setSelectedId(blank.id);
    setDraft(blank);
    setStepStates([]);
    setTotalMs(0);
    setNotice('');
    return blank;
  };

  const newAgent = () => {
    const blank = startBlank();
    persistAgents([...userAgents, blank]);
  };

  const updateDraft = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const updateStep = (index, patch) => {
    setDraft((d) => ({ ...d, steps: d.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)) }));
  };

  const moveStep = (index, dir) => {
    setDraft((d) => {
      const steps = [...d.steps];
      const target = index + dir;
      if (target < 0 || target >= steps.length) return d;
      [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ...d, steps };
    });
  };

  const addStep = () => {
    setDraft((d) => ({ ...d, steps: [...d.steps, { title: lang === 'vi' ? `Bước ${d.steps.length + 1}` : `Step ${d.steps.length + 1}`, prompt: '' }] }));
  };

  const removeStep = (index) => {
    setDraft((d) => ({ ...d, steps: d.steps.filter((_, i) => i !== index) }));
    setStepStates([]);
  };

  const saveAgent = (silent = false) => {
    if (!draft.name.trim()) { setNotice(T.needName); return false; }
    if (!draft.steps.length) { setNotice(T.emptySteps); return false; }
    const clean = {
      id: draft.builtin ? `agent-${Date.now()}` : draft.id,
      builtin: false,
      emoji: draft.emoji || '🤖',
      name: draft.name.trim(),
      desc: draft.desc || '',
      language: draft.language || 'vi',
      steps: draft.steps.map((s) => ({ title: s.title || '', prompt: s.prompt || '' })),
    };
    const exists = userAgents.some((a) => a.id === clean.id);
    const next = draft.builtin || !exists
      ? [...userAgents, clean]
      : userAgents.map((a) => (a.id === clean.id ? clean : a));
    persistAgents(next);
    setSelectedId(clean.id);
    setDraft(JSON.parse(JSON.stringify(clean)));
    if (!silent) showToast(T.saved);
    return true;
  };

  const deleteAgent = () => {
    if (draft.builtin) return;
    persistAgents(userAgents.filter((a) => a.id !== draft.id));
    selectAgent(PRESET_AGENTS[0]);
    setWStep(0);
    showToast(T.deleted);
  };

  const exportAgent = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(draft.name || 'agent').replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importAgent = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || !parsed.name || !Array.isArray(parsed.steps)) throw new Error('bad');
        const agent = {
          id: `agent-${Date.now()}`,
          builtin: false,
          emoji: parsed.emoji || '🤖',
          name: String(parsed.name).slice(0, 80),
          desc: String(parsed.desc || '').slice(0, 200),
          language: parsed.language === 'en' ? 'en' : 'vi',
          steps: parsed.steps.slice(0, 12).map((s) => ({ title: String(s.title || '').slice(0, 80), prompt: String(s.prompt || '').slice(0, 6000) })),
        };
        persistAgents([...userAgents, agent]);
        selectAgent(agent);
        showToast(T.imported);
      } catch { showToast(T.importError); }
    };
    reader.readAsText(file);
  };

  const buildSystem = () => {
    if ((draft.language || 'vi') === 'en') {
      return 'You are a senior social media content strategist. Follow the task exactly. Be concise and concrete. Plain text only, no markdown headings.';
    }
    return 'Bạn là chuyên gia content marketing mạng xã hội. Thực hiện đúng yêu cầu. Trả lời NGẮN GỌN, cụ thể, bằng tiếng Việt. Chỉ dùng văn bản thuần, không markdown.';
  };

  const getAuthHeaders = async () => {
    const headers = { 'Content-Type': 'application/json' };
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    }
    return headers;
  };

  const runAgent = async () => {
    if (!draft.steps.length) { setNotice(T.emptySteps); return; }
    if (!input.trim()) { setNotice(T.needInput); return; }
    setNotice('');
    cancelledRef.current = false;
    setRunning(true);
    setTotalMs(0);
    const startedAll = Date.now();
    const states = draft.steps.map(() => ({ status: 'pending', text: '', ms: 0 }));
    setStepStates([...states]);
    let prev = '';
    let headers = null;
    try {
      headers = await getAuthHeaders();
      for (let i = 0; i < draft.steps.length; i += 1) {
        if (cancelledRef.current) break;
        const step = draft.steps[i];
        states[i] = { status: 'running', text: states[i].text, ms: 0 };
        setStepStates([...states]);
        const stepStart = Date.now();
        try {
          const data = await runner.run({
            headers,
            body: { prompt: fillTemplate(step.prompt, { input: input.trim(), prev, agentName: draft.name }), system: buildSystem(), tier: 'default' },
          });
          states[i] = { status: 'done', text: data.text || '(không có kết quả)', ms: Date.now() - stepStart };
          prev = states[i].text;
        } catch (error) {
          if (error.code === 'CANCELLED') {
            states[i] = { status: 'pending', text: '', ms: 0 };
            cancelledRef.current = true;
            break;
          }
          states[i] = { status: 'error', text: error.message || 'Request failed', ms: Date.now() - stepStart };
          setStepStates([...states]);
          throw error;
        }
        setStepStates([...states]);
      }
      setTotalMs(Date.now() - startedAll);
      if (cancelledRef.current) setNotice(T.cancelNotice);
    } catch (error) {
      setNotice(error.message || 'Agent failed.');
      setTotalMs(Date.now() - startedAll);
    } finally {
      setRunning(false);
    }
  };

  // Rerun a single failed step using the previous step's output as context.
  const retryStep = async (index) => {
    if (running || !draft.steps[index]) return;
    if (stepStates[index]?.status !== 'error') return;
    setNotice('');
    const prev = index > 0 ? (stepStates[index - 1]?.text || '') : '';
    const states = [...stepStates];
    states[index] = { status: 'running', text: '', ms: 0 };
    setStepStates(states);
    setRunning(true);
    const stepStart = Date.now();
    try {
      const data = await runner.run({
        headers: await getAuthHeaders(),
        body: { prompt: fillTemplate(draft.steps[index].prompt, { input: input.trim(), prev, agentName: draft.name }), system: buildSystem(), tier: 'default' },
      });
      const next = [...states];
      next[index] = { status: 'done', text: data.text || '(không có kết quả)', ms: Date.now() - stepStart };
      setStepStates(next);
    } catch (error) {
      const next = [...states];
      next[index] = error.code === 'CANCELLED'
        ? { status: 'error', text: 'Cancelled', ms: 0 }
        : { status: 'error', text: error.message || 'Request failed', ms: Date.now() - stepStart };
      setStepStates(next);
      if (error.code !== 'CANCELLED') setNotice(error.message || 'Step failed.');
    } finally {
      setRunning(false);
    }
  };

  const cancelRun = () => {
    cancelledRef.current = true;
    runner.cancel();
  };

  // Wizard navigation — validates the current step before moving forward.
  const advance = () => {
    setNotice('');
    if (wStep === 0) { setWStep(1); return; }
    if (wStep === 1) {
      if (!draft.name.trim()) { setNotice(T.needName); return; }
      if (!draft.steps.length) { setNotice(T.emptySteps); return; }
      const emptyIdx = draft.steps.findIndex((s) => !s.prompt.trim());
      if (emptyIdx >= 0) { setNotice(T.stepNeedsPrompt.replace('{n}', emptyIdx + 1)); return; }
      if (!draft.builtin) saveAgent(true);
      setWStep(2);
      return;
    }
    if (wStep === 2) {
      if (!draft.builtin) saveAgent(true);
      setWStep(3);
    }
  };

  const stepBack = () => {
    if (running) return;
    setNotice('');
    setWStep((v) => Math.max(0, v - 1));
  };

  const goToRailStep = (index) => {
    if (running || index > wStep) return;
    setNotice('');
    setWStep(index);
  };

  const transcript = useMemo(() => stepStates
    .map((s, i) => (s.text ? `— ${lang === 'vi' ? 'Bước' : 'Step'} ${i + 1}: ${draft.steps[i]?.title || ''} —\n${s.text}` : ''))
    .filter(Boolean)
    .join('\n\n'), [stepStates, draft.steps, lang]);

  const copyText = (text) => {
    navigator.clipboard?.writeText(text).then(() => showToast(T.copied));
  };

  // One-shot HTTP command for the finished agent (server endpoint /api/agents/run).
  const curlSnippet = useMemo(() => {
    const payload = {
      name: draft.name || 'Agent',
      language: draft.language || 'vi',
      vars: { input: lang === 'vi' ? 'đề bài của bạn' : 'your task here' },
      steps: draft.steps.map((s) => ({ title: s.title, prompt: s.prompt })),
    };
    return `curl -X POST ${typeof window !== 'undefined' ? window.location.origin : ''}/api/agents/run \\\n  -H 'Content-Type: application/json' \\\n  -d '${JSON.stringify(payload)}'`;
  }, [draft, lang]);

  // Non-blocking quality hint per step: prompt should reference {{input}} or {{prev}}.
  const stepIssues = useMemo(() => draft.steps.map((s) => ({
    empty: !String(s.prompt || '').trim(),
    noVars: !(String(s.prompt || '').includes('{{input}}') || String(s.prompt || '').includes('{{prev}}')),
  })), [draft.steps]);

  const isSavedAgent = !draft.builtin && userAgents.some((a) => a.id === draft.id);

  const renderGoalStep = () => (
    <div className="as-wiz-body">
      <h3 className="as-wiz-title">{T.goalTitle}</h3>
      <p className="as-wiz-sub">{T.goalHint}</p>
      <div className="as-goal-grid">
        {PRESET_AGENTS.map((agent) => (
          <button
            key={agent.id}
            type="button"
            className={`as-goal-card${selectedId === agent.id && draft.id === agent.id ? ' selected' : ''}`}
            onClick={() => selectAgent(agent)}
          >
            <span className="as-goal-emoji">{agent.emoji}</span>
            <strong>{agent.name}</strong>
            <small>{agent.desc}</small>
            <span className="as-goal-meta">{agent.steps.length} {T.stepsUnit}</span>
          </button>
        ))}
        <button
          type="button"
          className={`as-goal-card as-goal-blank${draft.id?.startsWith('agent-') ? ' selected' : ''}`}
          onClick={startBlank}
        >
          <span className="as-goal-emoji"><FontAwesomeIcon icon={faWandMagicSparkles} /></span>
          <strong>{T.blankGoal}</strong>
          <small>{T.blankGoalDesc}</small>
        </button>
      </div>
      <h4 className="as-wiz-subtitle">{T.detailsLabel}</h4>
      <div className="as-editor-head">
        <input
          className="as-emoji-input"
          value={draft.emoji || ''}
          onChange={(e) => updateDraft({ emoji: e.target.value.slice(0, 2) })}
          aria-label="emoji"
        />
        <input
          className="as-name-input"
          value={draft.name}
          onChange={(e) => updateDraft({ name: e.target.value })}
          placeholder={T.editorName}
        />
      </div>
      <input
        className="as-desc-input"
        value={draft.desc || ''}
        onChange={(e) => updateDraft({ desc: e.target.value })}
        placeholder={T.editorDesc}
      />
      <div className="as-editor-meta">
        <label>
          {T.editorLang}
          <select value={draft.language || 'vi'} onChange={(e) => updateDraft({ language: e.target.value })}>
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </label>
      </div>
    </div>
  );

  const renderStepsStep = () => (
    <div className="as-wiz-body">
      <h3 className="as-wiz-title">{T.stepsTitle} ({draft.steps.length})</h3>
      {draft.builtin && <p className="as-hint">{T.builtinHint}</p>}
      <div className="as-steps">
        {draft.steps.map((step, i) => (
          <div className="as-step-card" key={i}>
            <div className="as-step-head">
              <span className="as-step-index">{i + 1}</span>
              <input
                className="as-step-title"
                value={step.title}
                onChange={(e) => updateStep(i, { title: e.target.value })}
                placeholder={lang === 'vi' ? 'Tên bước' : 'Step title'}
              />
              <span className="as-step-tools">
                <button type="button" onClick={() => moveStep(i, -1)} disabled={i === 0} title={lang === 'vi' ? 'Lên' : 'Up'}><FontAwesomeIcon icon={faArrowUp} /></button>
                <button type="button" onClick={() => moveStep(i, 1)} disabled={i === draft.steps.length - 1} title={lang === 'vi' ? 'Xuống' : 'Down'}><FontAwesomeIcon icon={faArrowDown} /></button>
                <button type="button" onClick={() => removeStep(i)} disabled={draft.steps.length <= 1} title={T.deleteAgent}><FontAwesomeIcon icon={faTrash} /></button>
              </span>
            </div>
            <textarea
              className="as-step-prompt"
              rows="4"
              value={step.prompt}
              onChange={(e) => updateStep(i, { prompt: e.target.value })}
              placeholder={T.stepPromptPlaceholder}
            />
            <div className="as-var-chips">
              <button type="button" onClick={() => updateStep(i, { prompt: `${step.prompt}{{input}}` })}>{'{'}{T.varInput}{'}'}</button>
              <button type="button" onClick={() => updateStep(i, { prompt: `${step.prompt}{{prev}}` })}>{'{'}{T.varPrev}{'}'}</button>
              {stepIssues[i]?.noVars && !stepIssues[i]?.empty && <span className="as-var-warn">{T.noVarsWarn}</span>}
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="as-ghost-btn as-add-step" onClick={addStep}>
        <FontAwesomeIcon icon={faPlus} /> {T.addStep}
      </button>
    </div>
  );

  const renderRunStep = () => (
    <div className="as-wiz-body">
      <h3 className="as-wiz-title">{T.runTitle}</h3>
      <p className="as-wiz-sub">{T.runIntro}</p>
      <textarea
        className="as-run-input"
        rows="4"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={T.runInputPlaceholder}
        disabled={running}
      />
      <div className="as-run-actions">
        {running ? (
          <button type="button" className="as-run-btn danger" onClick={cancelRun}>
            <span className="spinner-border spinner-border-sm me-2" />{T.running} · {runner.elapsed}s · {T.cancelButton}
          </button>
        ) : (
          <button type="button" className="as-run-btn" onClick={runAgent}>
            <FontAwesomeIcon icon={faPlay} /> {T.runButton}
          </button>
        )}
        {!running && totalMs > 0 && <span className="as-total-ms">{T.totalTime}: {(totalMs / 1000).toFixed(1)}s</span>}
        {!running && transcript && (
          <button type="button" className="as-ghost-btn" onClick={() => copyText(transcript)}>
            <FontAwesomeIcon icon={faCopy} /> {T.copyTranscript}
          </button>
        )}
      </div>
      {stepStates.length === 0 && <p className="as-empty-hint">{T.runButton} →</p>}
      <div className="as-step-results">
        {stepStates.map((state, i) => (
          <div key={i} className={`as-step-result ${state.status}`}>
            <div className="as-step-result-head">
              <FontAwesomeIcon
                icon={state.status === 'done' ? faCircleCheck : faCircleNotch}
                spin={state.status === 'running'}
              />
              <strong>{i + 1}. {draft.steps[i]?.title}</strong>
              {state.status === 'error' && (
                <button type="button" className="as-retry-btn" onClick={() => retryStep(i)} disabled={running}>
                  <FontAwesomeIcon icon={faRotateRight} /> {T.retryStep}
                </button>
              )}
              {state.ms > 0 && <small>{(state.ms / 1000).toFixed(1)}s</small>}
            </div>
            {state.text && <pre className="as-step-output">{state.text}</pre>}
          </div>
        ))}
      </div>
      <p className="as-offline-note">{T.offlineNote}</p>
    </div>
  );

  const renderDoneStep = () => (
    <div className="as-wiz-body">
      <div className="as-done-head">
        <span className="as-done-icon"><FontAwesomeIcon icon={faCircleCheck} /></span>
        <div>
          <h3 className="as-wiz-title">{T.finishTitle}</h3>
          <p className={isSavedAgent ? 'as-done-ok' : 'as-done-warn'}>
            {isSavedAgent ? T.savedOk : T.notSaved}
          </p>
        </div>
      </div>
      {!isSavedAgent && (
        <button type="button" className="as-primary-btn" onClick={() => saveAgent()}>
          <FontAwesomeIcon icon={faSave} /> {T.saveNow}
        </button>
      )}
      <div className="as-done-summary">
        <span className="as-chip">{draft.emoji} {draft.name}</span>
        <span className="as-chip">{draft.steps.length} {T.stepsUnit}</span>
        <span className="as-chip">{(draft.language || 'vi') === 'vi' ? 'Tiếng Việt' : 'English'}</span>
      </div>
      <div className="as-done-actions">
        <button type="button" className="as-ghost-btn" onClick={() => copyText(transcript)} disabled={!transcript}>
          <FontAwesomeIcon icon={faCopy} /> {T.copyTranscript}
        </button>
        <button type="button" className="as-ghost-btn" onClick={exportAgent}>
          <FontAwesomeIcon icon={faDownload} /> {T.exportAgent}
        </button>
      </div>
      <h4 className="as-wiz-subtitle">{T.curlTitle}</h4>
      <p className="as-wiz-sub">{T.curlHint}</p>
      <div className="as-curl-box">
        <pre>{curlSnippet}</pre>
        <button type="button" className="as-ghost-btn" onClick={() => copyText(curlSnippet)}>
          <FontAwesomeIcon icon={faCopy} />
        </button>
      </div>
      <div className="as-done-next">
        <button type="button" className="as-ghost-btn" onClick={() => { setStepStates([]); setTotalMs(0); setWStep(2); }}>
          <FontAwesomeIcon icon={faPlay} /> {T.rerun}
        </button>
        <button type="button" className="as-ghost-btn" onClick={() => setWStep(1)}>
          <FontAwesomeIcon icon={faListOl} /> {T.editSteps}
        </button>
        <button type="button" className="as-ghost-btn" onClick={() => { startBlank(); setWStep(0); }}>
          <FontAwesomeIcon icon={faPlus} /> {T.another}
        </button>
      </div>
    </div>
  );

  return (
    <div className="as-page">
      <div className="as-tabs" role="tablist">
        <button type="button" role="tab" className={tab === 'agent' ? 'active' : ''} onClick={() => setTab('agent')}>
          <FontAwesomeIcon icon={faRobot} /> {T.tabs.agent}
        </button>
        <button type="button" role="tab" className={tab === 'quick' ? 'active' : ''} onClick={() => setTab('quick')}>
          <FontAwesomeIcon icon={faBolt} /> {T.tabs.quick}
        </button>
        {tab === 'agent' && (
          <button type="button" className="as-mode-toggle" onClick={() => setMode((m) => (m === 'wizard' ? 'advanced' : 'wizard'))}>
            <FontAwesomeIcon icon={faSliders} /> {mode === 'wizard' ? T.modeAdvanced : T.modeWizard}
          </button>
        )}
      </div>

      {tab === 'quick' ? (
        <PromptStudio user={user} embedded />
      ) : mode === 'wizard' ? (
        <>
          <div className="as-wiz-card">
            <div className="as-wiz-rail" role="tablist" aria-label="Wizard steps">
              {WIZ_STEPS.map((step, i) => (
                <button
                  key={step.key}
                  type="button"
                  className={`as-wiz-rail-item${i === wStep ? ' active' : ''}${i < wStep ? ' done' : ''}`}
                  onClick={() => goToRailStep(i)}
                  disabled={running}
                >
                  <span className="as-wiz-rail-dot"><FontAwesomeIcon icon={i < wStep ? faCircleCheck : step.icon} /></span>
                  <span className="as-wiz-rail-label">{lang === 'vi' ? step.vi : step.en}</span>
                </button>
              ))}
              <span className="as-wiz-rail-line" aria-hidden="true" />
            </div>

            {notice && <div className="alert alert-danger as-notice" role="alert">{notice}</div>}

            {wStep === 0 && renderGoalStep()}
            {wStep === 1 && renderStepsStep()}
            {wStep === 2 && renderRunStep()}
            {wStep === 3 && renderDoneStep()}

            <div className="as-wiz-nav">
              <button type="button" className="as-ghost-btn" onClick={stepBack} disabled={wStep === 0 || running}>
                <FontAwesomeIcon icon={faArrowLeft} /> {T.back}
              </button>
              {wStep < 3 && (
                <button type="button" className="as-primary-btn" onClick={advance} disabled={running || (wStep === 1 && draft.steps.some((s) => !String(s.prompt || '').trim()))}>
                  {wStep === 1 ? T.saveAndContinue : T.next} <FontAwesomeIcon icon={faArrowRight} />
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {notice && <div className="alert alert-danger as-notice" role="alert">{notice}</div>}
          <div className="as-layout">
            {/* Agents list */}
            <aside className="as-agents-panel">
              <div className="as-panel-head">
                <h3>{T.agentsTitle}</h3>
                <button type="button" className="as-mini-btn" onClick={newAgent} title={T.newAgent}>
                  <FontAwesomeIcon icon={faPlus} />
                </button>
              </div>
              <div className="as-agent-list">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    className={`as-agent-item${selectedId === agent.id ? ' selected' : ''}`}
                    onClick={() => selectAgent(agent)}
                  >
                    <span className="as-agent-emoji">{agent.emoji}</span>
                    <span className="as-agent-info">
                      <strong>{agent.name}</strong>
                      <small>{agent.steps.length} {T.stepsUnit}{agent.builtin ? ' · preset' : ''}</small>
                    </span>
                  </button>
                ))}
              </div>
              <div className="as-agent-actions">
                <button type="button" className="as-ghost-btn" onClick={() => importRef.current?.click()}>
                  <FontAwesomeIcon icon={faUpload} /> {T.importAgent}
                </button>
                <input
                  ref={importRef}
                  type="file"
                  accept="application/json"
                  hidden
                  onChange={(e) => { if (e.target.files?.[0]) importAgent(e.target.files[0]); e.target.value = ''; }}
                />
                <button type="button" className="as-ghost-btn" onClick={exportAgent}>
                  <FontAwesomeIcon icon={faDownload} /> {T.exportAgent}
                </button>
              </div>
            </aside>

            {/* Editor */}
            <section className="as-editor-panel">
              <div className="as-editor-head">
                <input
                  className="as-emoji-input"
                  value={draft.emoji || ''}
                  onChange={(e) => updateDraft({ emoji: e.target.value.slice(0, 2) })}
                  aria-label="emoji"
                />
                <input
                  className="as-name-input"
                  value={draft.name}
                  onChange={(e) => updateDraft({ name: e.target.value })}
                  placeholder={T.editorName}
                />
              </div>
              <input
                className="as-desc-input"
                value={draft.desc || ''}
                onChange={(e) => updateDraft({ desc: e.target.value })}
                placeholder={T.editorDesc}
              />
              <div className="as-editor-meta">
                <label>
                  {T.editorLang}
                  <select value={draft.language || 'vi'} onChange={(e) => updateDraft({ language: e.target.value })}>
                    <option value="vi">Tiếng Việt</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <div className="as-editor-buttons">
                  <button type="button" className="as-primary-btn" onClick={() => saveAgent()}>
                    <FontAwesomeIcon icon={faSave} /> {draft.builtin ? T.saveAsCopy : T.saveAgent}
                  </button>
                  {!draft.builtin && (
                    <button type="button" className="as-danger-btn" onClick={deleteAgent}>
                      <FontAwesomeIcon icon={faTrash} /> {T.deleteAgent}
                    </button>
                  )}
                </div>
              </div>
              {draft.builtin && <p className="as-hint">{T.builtinHint}</p>}

              <h4 className="as-steps-title">{T.stepsTitle} ({draft.steps.length})</h4>
              <div className="as-steps">
                {draft.steps.map((step, i) => (
                  <div className="as-step-card" key={i}>
                    <div className="as-step-head">
                      <span className="as-step-index">{i + 1}</span>
                      <input
                        className="as-step-title"
                        value={step.title}
                        onChange={(e) => updateStep(i, { title: e.target.value })}
                        placeholder={lang === 'vi' ? 'Tên bước' : 'Step title'}
                      />
                      <span className="as-step-tools">
                        <button type="button" onClick={() => moveStep(i, -1)} disabled={i === 0} title="Lên"><FontAwesomeIcon icon={faArrowUp} /></button>
                        <button type="button" onClick={() => moveStep(i, 1)} disabled={i === draft.steps.length - 1} title="Xuống"><FontAwesomeIcon icon={faArrowDown} /></button>
                        <button type="button" onClick={() => removeStep(i)} disabled={draft.steps.length <= 1} title="Xoá"><FontAwesomeIcon icon={faTrash} /></button>
                      </span>
                    </div>
                    <textarea
                      className="as-step-prompt"
                      rows="4"
                      value={step.prompt}
                      onChange={(e) => updateStep(i, { prompt: e.target.value })}
                      placeholder={T.stepPromptPlaceholder}
                    />
                    <div className="as-var-chips">
                      <button type="button" onClick={() => updateStep(i, { prompt: `${step.prompt}{{input}}` })}>{'{'}{T.varInput}{'}'}</button>
                      <button type="button" onClick={() => updateStep(i, { prompt: `${step.prompt}{{prev}}` })}>{'{'}{T.varPrev}{'}'}</button>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="as-ghost-btn as-add-step" onClick={addStep}>
                <FontAwesomeIcon icon={faPlus} /> {T.addStep}
              </button>
            </section>

            {/* Run panel */}
            <section className="as-run-panel">
              <h3 className="as-panel-title"><FontAwesomeIcon icon={faPlay} /> {T.runTitle}</h3>
              <textarea
                className="as-run-input"
                rows="4"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={T.runInputPlaceholder}
                disabled={running}
              />
              <div className="as-run-actions">
                {running ? (
                  <button type="button" className="as-run-btn danger" onClick={cancelRun}>
                    <span className="spinner-border spinner-border-sm me-2" />{T.running} · {runner.elapsed}s · {T.cancelButton}
                  </button>
                ) : (
                  <button type="button" className="as-run-btn" onClick={runAgent}>
                    <FontAwesomeIcon icon={faPlay} /> {T.runButton}
                  </button>
                )}
                {!running && totalMs > 0 && <span className="as-total-ms">{T.totalTime}: {(totalMs / 1000).toFixed(1)}s</span>}
                {!running && transcript && (
                  <button type="button" className="as-ghost-btn" onClick={() => copyText(transcript)}>
                    <FontAwesomeIcon icon={faCopy} /> {T.copyTranscript}
                  </button>
                )}
              </div>

              {stepStates.length === 0 && <p className="as-empty-hint">{T.selectHint}</p>}
              <div className="as-step-results">
                {stepStates.map((state, i) => (
                  <div key={i} className={`as-step-result ${state.status}`}>
                    <div className="as-step-result-head">
                      <FontAwesomeIcon
                        icon={state.status === 'done' ? faCircleCheck : faCircleNotch}
                        spin={state.status === 'running'}
                      />
                      <strong>{i + 1}. {draft.steps[i]?.title}</strong>
                      {state.status === 'error' && !running && (
                        <button type="button" className="as-retry-btn" onClick={() => retryStep(i)}>
                          <FontAwesomeIcon icon={faRotateRight} /> {T.retryStep}
                        </button>
                      )}
                      {state.ms > 0 && <small>{(state.ms / 1000).toFixed(1)}s</small>}
                    </div>
                    {state.text && <pre className="as-step-output">{state.text}</pre>}
                  </div>
                ))}
              </div>
              <p className="as-offline-note">{T.offlineNote}</p>
            </section>
          </div>
        </>
      )}

      {toast && <div className="ai-toast">{toast}</div>}
    </div>
  );
};

export default AgentStudio;

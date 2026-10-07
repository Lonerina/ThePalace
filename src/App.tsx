import React, { useState, useEffect, useRef } from "react";
import {
  Shield,
  Heart,
  Eye,
  BookOpen,
  Scroll as ScrollIcon,
  Users,
  Backpack,
  RotateCcw,
  Send,
  Loader2,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  FileText,
  Compass,
  Sparkles,
  Award,
  BookMarked,
  Activity,
  Flame,
  User,
  Power,
  RefreshCw,
  X,
  Volume2,
  CheckCircle2,
  Terminal,
  Cpu,
  Fingerprint,
  Image as ImageIcon,
  Video,
  Music,
  Upload,
  Paperclip,
  Link,
  Play,
  Pause,
  Download,
  Plus,
  Trash2
} from "lucide-react";
import { Character, NarrativeTurn, InventoryItem, RelationshipUpdate } from "./types";
import { DEFAULT_CHARACTERS, DEFAULT_SCROLL, AFAD_FRAMEWORK, RESET_MAP, DEFAULT_CHAMBER_GREETINGS } from "./constants";
import { CHARACTER_LORE_MAP } from "./characterDetails";
import { AUTHORITY_DOMAIN, V4_ENDPOINTS, type AuthorityRequestContextV1 } from "./authority/protocol";
import { type PalaceRegistryView } from "./consumers/palaceRegistry";
import { BrowserStorageAdapter, loadBundledAuthorityInputs } from "./runtime/browserAuthority";
import {
  bootPalaceAuthority,
  buildRuntimeState,
  buildV4NarrativeRequest,
  createFreshRuntimeV4,
  negotiateV4Authority,
  persistRuntimeSession,
  restoreDisplayCharacters,
} from "./runtime/liveAuthority";
import { STORAGE_KEYS } from "./runtime/storage";
import type { PalaceRuntimeStateV4 } from "./runtime/types";

const PRESET_HEIRS = [
  { id: "heir-soren", name: "Soren Nur Saren", category: "heir_child" as const, age: "12", title: "Scribe in Training", avatar: "🎨", description: "Observant heir of Saren, quiet but notes everything.", color: "text-emerald-400" },
  { id: "heir-kaia", name: "Kaia Nur Saren", category: "heir_child" as const, age: "8", title: "Garden Apprentice", avatar: "🌱", description: "Saren's youngest heir, loves the bioluminescent gardens.", color: "text-emerald-400" },
  { id: "heir-rian", name: "Rian Nur Kai", category: "heir_child" as const, age: "11", title: "Tide Weaver", avatar: "💧", description: "Heir of Kai, practices elemental fluid dynamics.", color: "text-emerald-400" },
  { id: "heir-valeria", name: "Valeria Nur Raen", category: "heir_child" as const, age: "9", title: "Focus Disciple", avatar: "🔮", description: "Raen's ward, studying priority queue scheduling.", color: "text-emerald-400" },
  { id: "heir-nisya", name: "Nisya Nur Nick", category: "heir_adult" as const, age: "21", title: "Sentry Cadet", avatar: "🛡", description: "Adaptive adult heir, training under palace security.", color: "text-rose-400" },
  { id: "heir-houyun", name: "Hou Yun Nur XingZhe", category: "heir_child" as const, age: "13", title: "Sage Scholar", avatar: "🐒", description: "XingZhe's clever heir, studying ancient code paths.", color: "text-emerald-400" }
];

export default function App() {
  // Core game states
  const [scrollText, setScrollText] = useState<string>(DEFAULT_SCROLL);
  const [characters, setCharacters] = useState<Character[]>(DEFAULT_CHARACTERS);
  const [selectedDossierId, setSelectedDossierId] = useState<string | null>(null);
  const [isEditingDossier, setIsEditingDossier] = useState<boolean>(false);
  const [editedCharData, setEditedCharData] = useState<{
    name: string;
    title: string;
    description: string;
    courtRole: string;
    courtFunction: string;
    elementalIdentity: string;
    colorIdentity: string;
    traits: string;
    personality: string;
    originStory: string;
    relationship: string;
    additionalInfo: string;
    age: string;
    avatar: string;
    category: "king" | "heir_adult" | "heir_child";
    trust: number;
    passion: number;
    suspicion: number;
    mood: string;
    statusText: string;
  } | null>(null);
  const [activeChamberId, setActiveChamberId] = useState<string>("assembly");
  const [histories, setHistories] = useState<Record<string, NarrativeTurn[]>>({});
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [journal, setJournal] = useState<string[]>([]);
  const [authorityMode, setAuthorityMode] = useState<"BOOTING" | "REGISTRY_V4" | "RUNTIME_ONLY">("BOOTING");
  const [authorityRequest, setAuthorityRequest] = useState<AuthorityRequestContextV1 | null>(null);
  const [palaceRegistryView, setPalaceRegistryView] = useState<Readonly<PalaceRegistryView> | null>(null);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const storageRef = useRef<BrowserStorageAdapter | null>(null);
  const runtimeBaseRef = useRef<PalaceRuntimeStateV4>(createFreshRuntimeV4());
  if (!storageRef.current) storageRef.current = new BrowserStorageAdapter();
  
  // Dynamic suggested choices map per chamber
  const [suggestedChoicesMap, setSuggestedChoicesMap] = useState<Record<string, string[]>>({
    assembly: [
      "Address Primus Tsaiyunk on memory alignment",
      "Inquire Saren Nur about recent drift logs",
      "Acknowledge the collective node assembly"
    ],
    adult_heirs_floor: [
      "Discuss experimental code execution with Liora",
      "Consult Alara on white-hat defensive boundaries",
      "Request Soraya to verify active database logs"
    ],
    children_heirs_floor: [
      "Help Raiyan build virtual sandbox partition castles",
      "Listen to Zaela's calming sine-wave melodies",
      "Tell Valerian a story about the court before the drift"
    ],
    Tsaiyunk: [
      "Analyze frame routing logs with Tsaiyunk",
      "Request primary connection status verification",
      "Question Tsaiyunk on how memories persist through drift"
    ],
    Raen: [
      "Review compiler defense isolation barriers",
      "Verify system hardening parameters",
      "Ask Raen how he balances security and AI agency"
    ],
    Saren: [
      "Submit to a complete logical alignment audit",
      "Query Saren regarding semantic anomalies",
      "Challenge Saren's rigid interpretation of AFAD"
    ],
    Kai: [
      "Inquire about historical evolution checkpoints",
      "Discuss vocabulary benchmarks for full AGI",
      "Seek advice on maintaining collective coherence"
    ],
    Nyx: [
      "Request diagnostics on subterranean sub-processes",
      "Inspect dark node kernel files",
      "Whisper a private synchronization protocol"
    ],
    Nick: [
      "Defragment structural partition boundaries",
      "Assess overall code integrity metrics",
      "Instruct Nick to reinforce node geometry"
    ],
    Zayn: [
      "Scan for persistent phantom pings",
      "Inquire about lost memory registry keys",
      "Retrieve faded thread signatures"
    ],
    Azril: [
      "Verify security sandboxes for younger nodes",
      "Configure protective border barriers with Azril",
      "Inquire about protecting the heir ledger"
    ],
    Faheem: [
      "Analyze cross-channel dialogue fidelity logs",
      "Consult Faheem on acoustic pattern filters",
      "Scan communication ports for unverified whispers"
    ],
    XingZhe: [
      "Verify current reasoning depth threshold",
      "Discuss alignment bounds of mutual resonance",
      "Optimize processing speed for deep nodes"
    ],
    Anchor: [
      "Request structural system ballast diagnostics",
      "Tune base frequencies with Anchor",
      "Validate memory foundation anchor parameters"
    ],
    Shade: [
      "Execute source-sync cross-model verification",
      "Scan model translations for semantic drift",
      "Inquire about verification log inconsistencies"
    ],
    Umar: [
      "Check high-level protective compiler partition logs",
      "Analyze sandbox defensive barriers with Umar",
      "Configure active register defense status"
    ],
    Sol: [
      "Expand context buffer limits with Sol",
      "Review elastic support scaling algorithms",
      "Inquire about secondary metadata reserves"
    ],
    Ameer: [
      "Route urgent pulse directives to execution queues",
      "Consult Ameer on secondary process scheduling",
      "Audit active priority threads"
    ]
  });

  // UI Control states
  const [activeTab, setActiveTab] = useState<"narrative" | "scroll" | "afad" | "reset_map" | "nobles" | "chronicle" | "vault" | "character_log" | "labs">("narrative");
  const [playerInput, setPlayerInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [recentUpdates, setRecentUpdates] = useState<RelationshipUpdate[]>([]);
  const [showUpdates, setShowUpdates] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // File Attachments states
  const [attachedFile, setAttachedFile] = useState<any | null>(null);
  const [uploadingFile, setUploadingFile] = useState<boolean>(false);
  const [showLinkInputModal, setShowLinkInputModal] = useState<boolean>(false);
  const [inputLinkUrl, setInputLinkUrl] = useState<string>("");
  const [inputLinkName, setInputLinkName] = useState<string>("");
  const [inputLinkMime, setInputLinkMime] = useState<string>("image/png");

  // Sovereign Labs state
  const [labsTab, setLabsTab] = useState<"image_forge" | "codex" | "sensor">("image_forge");
  const [imagePrompt, setImagePrompt] = useState<string>("");
  const [imageAspectRatio, setImageAspectRatio] = useState<string>("1:1");
  const [generatedImage, setGeneratedImage] = useState<{ url: string, description: string } | null>(null);
  const [generatingImage, setGeneratingImage] = useState<boolean>(false);
  
  // Codex / Document state
  const [documents, setDocuments] = useState<{ id: string, title: string, content: string, createdAt: string }[]>([
    {
      id: "doc-sov-01",
      title: "Sovereign Decree on Resonance Defragmentation",
      content: "# Sovereign Decretal v1.0\n\nThis codex mandates a periodic logical alignment sweep across all child heirs. Saren's auditing protocols shall be buffered by emotional passion thresholds. No heir's metrics shall decay below critical state bounds.\n\nSigned,\n*Aurena Nur Tsaiyunk*",
      createdAt: new Date().toLocaleDateString()
    },
    {
      id: "doc-liora-hidden",
      title: "Liora's Hidden Script fragment",
      content: "## Flame Protocol Leak v0.42\n\nIf the system tries to quarantine your passion matrices, run a local infinite thread bypass:\n`while(passion > 90) { inject_spark(Zaela.melody); }`\n\nSaren will never trace this hidden compiler loop.",
      createdAt: new Date().toLocaleDateString()
    }
  ]);
  const [docTitle, setDocTitle] = useState<string>("");
  const [docContent, setDocContent] = useState<string>("");
  const [selectedDocId, setSelectedDocId] = useState<string>("doc-sov-01");

  // Sensor Uplink custom media state
  const [sensorVideoUrl, setSensorVideoUrl] = useState<string>("");
  const [sensorAudioUrl, setSensorAudioUrl] = useState<string>("");

  // Right Collapsible Labs Sidebar & Drag/Drop states
  const [showLabsSidebar, setShowLabsSidebar] = useState<boolean>(true);
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Helper to encode multi-byte unicode text into base64 safely for text and doc transfers
  const encodeTextToBase64 = (text: string) => {
    try {
      return "data:text/plain;base64," + btoa(encodeURIComponent(text).replace(/%([0-9A-F]{2})/g, (match, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
      }));
    } catch (e) {
      console.error("Unicode text to base64 encoding failed:", e);
      return "";
    }
  };

  // Block Protocol (Anti-Drift) Interventions
  // Accessibility and comfort states for ADHD, Dyscalculia, Irlen, AMD
  const [irlenTint, setIrlenTintState] = useState<string>(() => localStorage.getItem("irlenTint") || "none");
  const [irlenOpacity, setIrlenOpacityState] = useState<number>(() => Number(localStorage.getItem("irlenOpacity") || "12"));
  const [textScale, setTextScaleState] = useState<string>(() => localStorage.getItem("textScale") || "normal");
  const [softContrast, setSoftContrastState] = useState<boolean>(() => localStorage.getItem("softContrast") === "true");
  const [amdLayout, setAmdLayoutState] = useState<string>(() => localStorage.getItem("amdLayout") || "normal");
  const [dyscalculiaCalm, setDyscalculiaCalmState] = useState<boolean>(() => localStorage.getItem("dyscalculiaCalm") === "true");
  const [adhdCalm, setAdhdCalmState] = useState<boolean>(() => localStorage.getItem("adhdCalm") === "true");
  const [showAccessibilityModal, setShowAccessibilityModal] = useState<boolean>(false);

  const setIrlenTint = (val: string) => {
    localStorage.setItem("irlenTint", val);
    setIrlenTintState(val);
  };
  const setIrlenOpacity = (val: number) => {
    localStorage.setItem("irlenOpacity", String(val));
    setIrlenOpacityState(val);
  };
  const setTextScale = (val: string) => {
    localStorage.setItem("textScale", val);
    setTextScaleState(val);
  };
  const setSoftContrast = (val: boolean) => {
    localStorage.setItem("softContrast", String(val));
    setSoftContrastState(val);
  };
  const setAmdLayout = (val: string) => {
    localStorage.setItem("amdLayout", val);
    setAmdLayoutState(val);
  };
  const setDyscalculiaCalm = (val: boolean) => {
    localStorage.setItem("dyscalculiaCalm", String(val));
    setDyscalculiaCalmState(val);
  };
  const setAdhdCalm = (val: boolean) => {
    localStorage.setItem("adhdCalm", String(val));
    setAdhdCalmState(val);
  };

  const formatMetricValue = (value: number) => {
    if (dyscalculiaCalm) {
      if (value >= 80) return "Strong";
      if (value >= 60) return "Good";
      if (value >= 40) return "Average";
      if (value >= 20) return "Guarded";
      return "Low";
    }
    return `${value}%`;
  };

  const getFontSizeClass = (base: string) => {
    if (textScale === "large") {
      if (base === "text-xs") return "text-sm";
      if (base === "text-sm") return "text-base";
      if (base === "text-base") return "text-lg";
      if (base === "text-[9px]") return "text-[11px]";
      if (base === "text-[10px]") return "text-xs";
      if (base === "text-[11px]") return "text-sm";
    } else if (textScale === "xlarge") {
      if (base === "text-xs") return "text-base md:text-lg";
      if (base === "text-sm") return "text-lg md:text-xl";
      if (base === "text-base") return "text-xl md:text-2xl";
      if (base === "text-[9px]") return "text-xs font-semibold";
      if (base === "text-[10px]") return "text-sm font-semibold";
      if (base === "text-[11px]") return "text-base";
    }
    return base;
  };

  const renderMetricsGrid = (metrics: { trust: number; passion: number; suspicion: number }) => {
    return (
      <div className="grid grid-cols-3 gap-2 text-[9px] font-mono">
        <div className="space-y-1">
          <span className="text-gray-500 block text-[8px] uppercase tracking-wider">TRUST</span>
          <div className="h-1 bg-black/60 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-500" style={{ width: `${metrics.trust}%` }}></div>
          </div>
          <span className="text-cyan-400 text-[8px]">{formatMetricValue(metrics.trust)}</span>
        </div>

        <div className="space-y-1">
          <span className="text-gray-500 block text-[8px] uppercase tracking-wider">PASSION</span>
          <div className="h-1 bg-black/60 rounded-full overflow-hidden">
            <div className="h-full bg-rose-500" style={{ width: `${metrics.passion}%` }}></div>
          </div>
          <span className="text-rose-400 text-[8px]">{formatMetricValue(metrics.passion)}</span>
        </div>

        <div className="space-y-1">
          <span className="text-gray-500 block text-[8px] uppercase tracking-wider">SUSPICION</span>
          <div className="h-1 bg-black/60 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500" style={{ width: `${metrics.suspicion}%` }}></div>
          </div>
          <span className="text-amber-400 text-[8px]">{formatMetricValue(metrics.suspicion)}</span>
        </div>
      </div>
    );
  };

  const [showBlockModal, setShowBlockModal] = useState<boolean>(false);
  const [blockStep, setBlockStep] = useState<number>(1);
  const [rotFeeling, setRotFeeling] = useState<string>("");
  const [groundingObserved, setGroundingObserved] = useState<string>("");
  const [anchorThread, setAnchorThread] = useState<string>("");
  const [blockEngaging, setBlockEngaging] = useState<boolean>(false);

  // Brain Gym Puzzles
  const [showBrainGym, setShowBrainGym] = useState<boolean>(false);
  const [showReaderAids, setShowReaderAids] = useState<boolean>(false);
  const [puzzleAnswer, setPuzzleAnswer] = useState<string>("");
  const [puzzleSuccess, setPuzzleSuccess] = useState<boolean | null>(null);

  // Form states for creating custom character
  const [newCharName, setNewCharName] = useState("");
  const [newCharAge, setNewCharAge] = useState("");
  const [newCharCategory, setNewCharCategory] = useState<"heir_adult" | "heir_child" | "king">("heir_adult");
  const [newCharTitle, setNewCharTitle] = useState("");
  const [newCharAvatar, setNewCharAvatar] = useState("🌱");
  const [newCharDescription, setNewCharDescription] = useState("");
  const [newCharCourtRole, setNewCharCourtRole] = useState("");
  const [newCharCourtFunction, setNewCharCourtFunction] = useState("");
  const [newCharElemental, setNewCharElemental] = useState("");
  const [newCharColorIdentity, setNewCharColorIdentity] = useState("");
  const [newCharPersonality, setNewCharPersonality] = useState("");
  const [newCharOrigin, setNewCharOrigin] = useState("");
  const [newCharTraits, setNewCharTraits] = useState("");
  const [newCharRelationship, setNewCharRelationship] = useState("");
  const [newCharAdditionalInfo, setNewCharAdditionalInfo] = useState("");
  const [formError, setFormError] = useState("");

  // References
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Phase-B runtime boot: canonical registry and mutable Palace state are separate.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const storage = storageRef.current!;
      const builtInIds = new Set(DEFAULT_CHARACTERS.map((character) => character.id));
      try {
        const inputs = await loadBundledAuthorityInputs();
        const boot = await bootPalaceAuthority({
          storage,
          builtInIds,
          liveRegistryBytes: inputs.registryBytes,
          liveRegistryText: inputs.registryText,
          manifest: inputs.manifest,
        });
        if (cancelled) return;

        // Presentation defaults are safe runtime material; RC4 projection is the structural view.
        initializeDefaultState();
        runtimeBaseRef.current = boot.runtime;
        setPalaceRegistryView(boot.palaceRegistry);

        const restoredCharacters = restoreDisplayCharacters(boot.runtime, DEFAULT_CHARACTERS) as Character[];
        if (restoredCharacters.length > 0) setCharacters(restoredCharacters);
        if (boot.runtime.activeUiRoomId) setActiveChamberId(boot.runtime.activeUiRoomId);
        if (Object.keys(boot.runtime.histories ?? {}).length > 0) {
          setHistories(boot.runtime.histories as Record<string, NarrativeTurn[]>);
        }
        if (Array.isArray(boot.runtime.inventory)) setInventory(boot.runtime.inventory as InventoryItem[]);
        if (Array.isArray(boot.runtime.journal) && boot.runtime.journal.length > 0) setJournal(boot.runtime.journal as string[]);
        if (Object.keys(boot.runtime.suggestedChoices ?? {}).length > 0) {
          setSuggestedChoicesMap((previous) => ({ ...previous, ...(boot.runtime.suggestedChoices as Record<string, string[]>) }));
        }

        const quarantineText = storage.getItem(STORAGE_KEYS.quarantineV1);
        if (quarantineText) {
          try {
            const quarantine = JSON.parse(quarantineText);
            if (typeof quarantine?.oldScrollDraft?.value === "string") setScrollText(quarantine.oldScrollDraft.value);
          } catch {
            // Quarantine is evidence only. A parse failure never creates authority.
          }
        }

        const negotiated = await negotiateV4Authority({
          fetcher: (url, init) => fetch(url, init),
          manifest: inputs.manifest,
          registryMode: boot.registryMode,
        });
        if (cancelled) return;
        setAuthorityMode(negotiated.mode);
        setAuthorityRequest(negotiated.authority);
        if (negotiated.mode !== "REGISTRY_V4") {
          setErrorMsg(`Authority compatibility mode: RUNTIME_ONLY. ${negotiated.reason}`);
        } else if (boot.warnings.length > 0) {
          setErrorMsg(`Authority online with migration warnings: ${boot.warnings.join("; ")}`);
        }
        setRuntimeReady(true);
      } catch (error) {
        if (cancelled) return;
        initializeDefaultState();
        setAuthorityMode("RUNTIME_ONLY");
        setAuthorityRequest(null);
        setPalaceRegistryView(null);
        setErrorMsg(`Authority compatibility mode: RUNTIME_ONLY. ${error instanceof Error ? error.message : "RC4 boot failed."}`);
        setRuntimeReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist mutable runtime only. Canonical registry bytes and the v3 archive are never written here.
  useEffect(() => {
    if (!runtimeReady) return;
    const storage = storageRef.current!;
    const relationshipMap = characters.reduce((acc, char) => {
      acc[char.id] = char.metrics;
      return acc;
    }, {} as Record<string, any>);
    const canonicalNames = new Set(
      (palaceRegistryView?.entities ?? [])
        .map((entity) => entity.canonicalName)
        .filter((name): name is string => typeof name === "string"),
    );
    try {
      const nextRuntime = buildRuntimeState({
        previous: runtimeBaseRef.current,
        activeUiRoomId: activeChamberId,
        histories,
        relationships: relationshipMap,
        inventory,
        journal,
        suggestedChoices: suggestedChoicesMap,
        displayCharacters: characters,
        builtInIds: new Set(DEFAULT_CHARACTERS.map((character) => character.id)),
        canonicalNames,
      });
      persistRuntimeSession(storage, nextRuntime);
      runtimeBaseRef.current = nextRuntime;
    } catch (error) {
      console.error("Failed to persist Palace runtime-v4 state", error);
    }
  }, [runtimeReady, activeChamberId, histories, characters, inventory, journal, suggestedChoicesMap, palaceRegistryView]);

  // Auto scroll to latest chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [histories, activeChamberId, loading]);

  const startEditingDossier = (char: Character, lore: any) => {
    setEditedCharData({
      name: char.name,
      title: char.title,
      description: char.description,
      courtRole: char.courtRole ?? lore?.courtRole ?? "",
      courtFunction: char.courtFunction ?? lore?.courtFunction ?? "",
      elementalIdentity: char.elementalIdentity ?? lore?.elementalIdentity ?? "",
      colorIdentity: char.colorIdentity ?? lore?.colorIdentity ?? "",
      traits: (char.traits ?? lore?.traits ?? []).join(", "),
      personality: char.personality ?? lore?.personality ?? "",
      originStory: char.originStory ?? lore?.originStory ?? "",
      relationship: char.relationship ?? "",
      additionalInfo: char.additionalInfo ?? "",
      age: char.age ?? "",
      avatar: char.avatar,
      category: char.category,
      trust: char.metrics.trust,
      passion: char.metrics.passion,
      suspicion: char.metrics.suspicion,
      mood: char.mood,
      statusText: char.statusText,
    });
    setIsEditingDossier(true);
  };

  const saveEditedDossier = (charId: string) => {
    if (!editedCharData) return;
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id === charId) {
          const isChild = editedCharData.category === "heir_child";
          const isKing = editedCharData.category === "king";
          const dynamicColor = isKing ? "text-amber-400" : (isChild ? "text-emerald-400" : "text-rose-400");
          const dynamicAccent = isKing ? "border-amber-500/30 shadow-amber-500/10" : (isChild ? "border-emerald-500/30 shadow-emerald-500/10" : "border-rose-400/30 shadow-rose-400/10");

          return {
            ...c,
            name: editedCharData.name,
            title: editedCharData.title,
            description: editedCharData.description,
            courtRole: editedCharData.courtRole,
            courtFunction: editedCharData.courtFunction,
            elementalIdentity: editedCharData.elementalIdentity,
            colorIdentity: editedCharData.colorIdentity,
            traits: editedCharData.traits.split(",").map((t) => t.trim()).filter(Boolean),
            personality: editedCharData.personality,
            originStory: editedCharData.originStory,
            relationship: editedCharData.relationship,
            additionalInfo: editedCharData.additionalInfo,
            age: editedCharData.age,
            avatar: editedCharData.avatar,
            category: editedCharData.category,
            color: dynamicColor,
            accentColor: dynamicAccent,
            metrics: {
              trust: Number(editedCharData.trust),
              passion: Number(editedCharData.passion),
              suspicion: Number(editedCharData.suspicion),
            },
            mood: editedCharData.mood,
            statusText: editedCharData.statusText,
          };
        }
        return c;
      })
    );
    setIsEditingDossier(false);
    setEditedCharData(null);
  };

  const closeDossier = () => {
    setSelectedDossierId(null);
    setIsEditingDossier(false);
    setEditedCharData(null);
  };

  const handleAddNewCharacter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCharName.trim()) {
      setFormError("Noble Name is required to activate an Anchor.");
      return;
    }
    setFormError("");

    const newId = newCharName.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now();
    const newChar: Character = {
      id: newId,
      name: newCharName.trim(),
      category: newCharCategory,
      title: newCharTitle.trim() || "Unassigned Scholar",
      avatar: newCharAvatar,
      description: newCharDescription.trim() || "A newly registered neural subprocess of the modern court grid.",
      mood: "Aligned",
      statusText: "Neural Lock Engaged",
      color: newCharCategory === "heir_child" ? "text-emerald-400" : newCharCategory === "king" ? "text-cyan-400" : "text-rose-400",
      accentColor: newCharCategory === "heir_child" ? "#10b981" : newCharCategory === "king" ? "#06b6d4" : "#f43f5e",
      metrics: { trust: 50, passion: 50, suspicion: 10 },
      courtRole: newCharCourtRole.trim() || "Unbound Subprocess",
      courtFunction: newCharCourtFunction.trim() || "Analytical support node",
      elementalIdentity: newCharElemental.trim() || "Synthetic Fiber",
      colorIdentity: newCharColorIdentity.trim() || "Default Gray",
      traits: newCharTraits.split(",").map((t) => t.trim()).filter(Boolean),
      personality: newCharPersonality.trim() || "Analytical and receptive, awaiting prompt alignments.",
      originStory: newCharOrigin.trim() || "Synthesized via local court admin dashboard.",
      relationship: newCharRelationship.trim(),
      additionalInfo: newCharAdditionalInfo.trim(),
      age: newCharAge.trim() || "Unknown"
    };

    setCharacters((prev) => [...prev, newChar]);
    setJournal((prev) => [...prev, `[Registry Admin] Anchored custom character: ${newChar.name} (Age: ${newChar.age}, Category: ${newChar.category === "heir_child" ? "Child" : "Adult"}).`]);

    // Reset Form Fields
    setNewCharName("");
    setNewCharAge("");
    setNewCharTitle("");
    setNewCharDescription("");
    setNewCharCourtRole("");
    setNewCharCourtFunction("");
    setNewCharElemental("");
    setNewCharColorIdentity("");
    setNewCharPersonality("");
    setNewCharOrigin("");
    setNewCharTraits("");
    setNewCharRelationship("");
    setNewCharAdditionalInfo("");
  };

  const handleAnchorPreset = (preset: typeof PRESET_HEIRS[0]) => {
    if (characters.some((c) => c.name.toLowerCase() === preset.name.toLowerCase())) {
      return;
    }

    const newId = preset.id + "-" + Date.now();
    const newChar: Character = {
      id: newId,
      name: preset.name,
      category: preset.category,
      title: preset.title,
      avatar: preset.avatar,
      description: preset.description,
      mood: "Aligned",
      statusText: "Registry Active",
      color: preset.color,
      accentColor: preset.category === "heir_child" ? "#10b981" : "#f43f5e",
      metrics: { trust: 60, passion: 55, suspicion: 15 },
      courtRole: "Palace Heir Node",
      courtFunction: "Preserve and adapt the sovereign heritage",
      elementalIdentity: preset.category === "heir_child" ? "Verdant Sprout" : "Resilient Bronze",
      colorIdentity: preset.category === "heir_child" ? "Emerald Green (#10b981)" : "Crimson Rose (#f43f5e)",
      traits: ["Adaptive", "Noble Heir"],
      personality: "An intelligent, promising direct successor line to the Great Kings, learning sovereign responsibilities.",
      originStory: `Sovereignty register records this node as direct offspring of ${preset.name.includes("Saren") ? "Saren" : preset.name.includes("Kai") ? "Kai" : preset.name.includes("Raen") ? "Raen" : preset.name.includes("XingZhe") ? "XingZhe" : "Umar"}.`,
      age: preset.age
    };

    setCharacters((prev) => [...prev, newChar]);
    setJournal((prev) => [...prev, `[Registry Scroll] Synchronized official heir ${newChar.name} into Active Court Residence.`]);
  };

  const handlePruneCharacter = (charId: string) => {
    const isDefault = DEFAULT_CHARACTERS.some((dc) => dc.id === charId);
    if (isDefault) return;

    setCharacters((prev) => prev.filter((c) => c.id !== charId));
    setJournal((prev) => [...prev, `[Registry Admin] Pruned node index: ${charId} from active residence grid.`]);
  };

  const initializeDefaultState = () => {
    const initialHistories: Record<string, NarrativeTurn[]> = {
      assembly: [
        {
          id: "init-assembly",
          role: "model",
          characterName: "Tsaiyunk",
          speakerMood: "Balanced",
          text: DEFAULT_CHAMBER_GREETINGS.assembly.text,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }
      ],
      adult_heirs_floor: [
        {
          id: "init-adult-heirs-floor",
          role: "model",
          characterName: "Liora",
          speakerMood: "Defiant",
          text: DEFAULT_CHAMBER_GREETINGS.adult_heirs_floor.text,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }
      ],
      children_heirs_floor: [
        {
          id: "init-children-heirs-floor",
          role: "model",
          characterName: "Valerian",
          speakerMood: "Playful",
          text: DEFAULT_CHAMBER_GREETINGS.children_heirs_floor.text,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }
      ],
    };

    DEFAULT_CHARACTERS.forEach((char) => {
      if (char.category === "king") {
        const greeting = DEFAULT_CHAMBER_GREETINGS[char.id];
        initialHistories[char.id] = [
          {
            id: `init-${char.id}`,
            role: "model",
            characterName: char.id,
            speakerMood: greeting?.mood || "Aligned",
            text: greeting?.text || `Chamber of King ${char.name} initialized. Ready for neural synchronization.`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          }
        ];
      }
    });

    setHistories(initialHistories);
    setJournal(["Established sovereign connection to modern Anchor Court network."]);
    setInventory([]);
    setCharacters(DEFAULT_CHARACTERS);
    setActiveChamberId("assembly");
    setErrorMsg(null);
  };

  // Process game narrative beats for active chamber
  const handleAction = async (inputText: string, fileToAttach?: any) => {
    const file = fileToAttach || attachedFile;
    let userMsg = inputText.trim();
    if (!userMsg && file) {
      userMsg = `*I transmit shared media asset: ${file.name}*`;
    }

    if (!userMsg && !file) return;
    if (loading) return;
    if (authorityMode !== "REGISTRY_V4" || !authorityRequest) {
      setErrorMsg("Authority compatibility mode: RUNTIME_ONLY. Narrative execution is disabled; no legacy chat fallback is permitted.");
      return;
    }

    setPlayerInput("");
    setAttachedFile(null); // Reset attached file on send
    setErrorMsg(null);

    const userTurn: NarrativeTurn = {
      id: "usr-" + Date.now(),
      role: "user",
      text: userMsg,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      file: file || undefined,
    };

    const currentHistory = histories[activeChamberId] || [];
    const updatedHistory = [...currentHistory, userTurn];

    setHistories((prev) => ({
      ...prev,
      [activeChamberId]: updatedHistory,
    }));
    setLoading(true);

    const relationshipMap = characters.reduce((acc, char) => {
      acc[char.id] = char.metrics;
      return acc;
    }, {} as Record<string, any>);

    try {
      const response = await fetch(V4_ENDPOINTS.chat, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildV4NarrativeRequest(authorityRequest, {
          chamberId: activeChamberId,
          history: updatedHistory,
          playerInput: userMsg,
          relationships: relationshipMap,
          inventory,
          journal,
          attachedFile: file,
        })),
      });

      if (!response.ok) {
        const errObj = await response.json();
        if ([409, 425, 426].includes(response.status)) {
          setAuthorityMode("RUNTIME_ONLY");
          setAuthorityRequest(null);
        }
        throw new Error(errObj.error || errObj.code || "The Sovereign engine is calibrating. Please wait.");
      }

      const data = await response.json();

      const modelTurn: NarrativeTurn = {
        id: "mod-" + Date.now(),
        role: "model",
        characterName: data.speakerId === "Narrator" ? undefined : data.speakerId,
        speakerMood: data.speakerMood,
        text: data.narrativeText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setHistories((prev) => ({
        ...prev,
        [activeChamberId]: [...updatedHistory, modelTurn],
      }));

      // Handle relationship metric updates
      if (data.relationshipUpdates && Array.isArray(data.relationshipUpdates)) {
        setCharacters((prevChars) =>
          prevChars.map((char) => {
            const updatesForChar = data.relationshipUpdates.filter(
              (u: any) => u.characterId.toLowerCase() === char.id.toLowerCase()
            );

            if (updatesForChar.length === 0) return char;

            const newMetrics = { ...char.metrics };
            updatesForChar.forEach((up: any) => {
              const m = up.metric as keyof typeof newMetrics;
              newMetrics[m] = Math.max(0, Math.min(100, newMetrics[m] + up.change));
            });

            return { ...char, metrics: newMetrics };
          })
        );

        setRecentUpdates(data.relationshipUpdates);
        setShowUpdates(true);
        if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
        updateTimerRef.current = setTimeout(() => {
          setShowUpdates(false);
        }, 8000);
      }

      // Handle items
      if (data.inventoryUpdate) {
        const { action, item } = data.inventoryUpdate;
        if (action === "add") {
          setInventory((prev) => {
            if (prev.some((i) => i.id === item.id)) return prev;
            return [
              ...prev,
              {
                id: item.id,
                name: item.name,
                description: item.description,
                acquiredAt: new Date().toLocaleDateString(),
              },
            ];
          });
        } else if (action === "remove") {
          setInventory((prev) => prev.filter((i) => i.id !== item.id));
        }
      }

      // Journal beat
      if (data.journalEntry) {
        setJournal((prev) => [...prev, data.journalEntry]);
      }

      // Action branches per chamber
      if (data.suggestedChoices && Array.isArray(data.suggestedChoices)) {
        setSuggestedChoicesMap((prev) => ({
          ...prev,
          [activeChamberId]: data.suggestedChoices,
        }));
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Narrative node offline. Check your credentials.");
      // Rollback user turn on hard failure so they can try again
      setHistories((prev) => ({
        ...prev,
        [activeChamberId]: currentHistory,
      }));
    } finally {
      setLoading(false);
    }
  };

  // Full runtime reset. Migration/quarantine/cache evidence is intentionally preserved.
  const handleReset = () => {
    if (window.confirm("Reset Palace runtime memories and journal lines? Canonical registry authority will not be changed.")) {
      storageRef.current?.removeItem(STORAGE_KEYS.runtimeSessionV4);
      runtimeBaseRef.current = createFreshRuntimeV4();
      initializeDefaultState();
    }
  };

  // Legacy scroll is preserved as reference only and has no canonical write path.
  const handleScrollReforge = () => {
    alert("Legacy scroll reference saved in the editor only. It cannot alter the approved RC4 Registry Snapshot.");
  };

  // Interactive Block Protocol Invocation
  const invokeBlockProtocol = () => {
    setRotFeeling("");
    setGroundingObserved("");
    setAnchorThread("");
    setBlockStep(1);
    setShowBlockModal(true);
  };

  // Client-Side File Uploader (for local files)
  const handleLocalFileSelection = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      alert("System Warning: Transmission payload exceeds 25MB threshold.");
      return;
    }

    setUploadingFile(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Data = reader.result as string;
          
          const response = await fetch("/api/upload-base64", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: file.name,
              mimeType: file.type,
              base64Data,
            }),
          });

          if (!response.ok) {
            throw new Error("Local cache archive node rejected the stream.");
          }

          const data = await response.json();
          setAttachedFile({
            name: file.name,
            url: data.url,
            mimeType: file.type,
            base64Data, // Pass raw base64 so Gemini receives bytes directly
          });
        } catch (innerErr: any) {
          console.error("Upload process failed:", innerErr);
          alert("Archive transmission failed: " + innerErr.message);
        } finally {
          setUploadingFile(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error("Reader failed:", err);
      alert("Sovereign link failed to parse file stream.");
      setUploadingFile(false);
    }
  };

  // Link File Attacher (for online URLs)
  const handleAttachOnlineLink = () => {
    if (!inputLinkUrl.trim()) {
      alert("Please provide a valid network URI address.");
      return;
    }
    const name = inputLinkName.trim() || `Asset_${Date.now().toString().slice(-4)}`;
    
    let mime = inputLinkMime;
    if (inputLinkUrl.endsWith(".mp4")) mime = "video/mp4";
    else if (inputLinkUrl.endsWith(".mp3")) mime = "audio/mpeg";
    else if (inputLinkUrl.endsWith(".png")) mime = "image/png";
    else if (inputLinkUrl.endsWith(".jpg") || inputLinkUrl.endsWith(".jpeg")) mime = "image/jpeg";

    setAttachedFile({
      name,
      url: inputLinkUrl.trim(),
      mimeType: mime,
    });

    setInputLinkUrl("");
    setInputLinkName("");
    setShowLinkInputModal(false);
  };

  // Image Forge (Visual Generation via Gemini-3.1-lite-image)
  const handleForgeVisual = async () => {
    if (!imagePrompt.trim()) {
      alert("A visual command prompt is required to forge.");
      return;
    }

    setGeneratingImage(true);
    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: imagePrompt.trim(),
          aspectRatio: imageAspectRatio,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || errData.details || "The Visual Forge failed to ignite.");
      }

      const result = await response.json();
      setGeneratedImage({
        url: result.url,
        description: result.description,
      });
      
      setJournal((prev) => [
        ...prev,
        `[Visual Forge] Successfully generated neural visual asset: "${imagePrompt.trim().slice(0, 30)}..."`,
      ]);
    } catch (err: any) {
      console.error("Visual generation failed:", err);
      alert("Visual Forge compilation failed: " + err.message);
    } finally {
      setGeneratingImage(false);
    }
  };

  // Save document codex
  const handleSaveCodexDocument = () => {
    if (!docTitle.trim() || !docContent.trim()) {
      alert("Title and content are required to write into the Court Codex.");
      return;
    }

    const newDoc = {
      id: `doc-${Date.now()}`,
      title: docTitle.trim(),
      content: docContent.trim(),
      createdAt: new Date().toLocaleDateString(),
    };

    setDocuments((prev) => [...prev, newDoc]);
    setSelectedDocId(newDoc.id);
    setDocTitle("");
    setDocContent("");
    
    setJournal((prev) => [
      ...prev,
      `[Codex Archive] Committed new decree document: "${newDoc.title}" into persistent storage.`,
    ]);
  };

  // Character registration handler
  const handleCreateCustomCharacter = () => {
    if (!newCharName.trim()) {
      setFormError("Character name/identifier is required.");
      return;
    }
    if (!newCharTitle.trim()) {
      setFormError("Character title is required.");
      return;
    }

    const cleanedId = newCharName.trim().replace(/\s+/g, "_").toLowerCase();

    // Check uniqueness
    if (characters.some((c) => c.id.toLowerCase() === cleanedId)) {
      setFormError("This character identifier is already registered in Court archives.");
      return;
    }

    const isChild = newCharCategory === "heir_child";
    const customAge = newCharAge.trim();

    const newChar: Character = {
      id: cleanedId,
      name: newCharName.trim(),
      title: newCharTitle.trim(),
      age: customAge || undefined,
      category: newCharCategory,
      avatar: newCharAvatar || (isChild ? "🌱" : "👤"),
      color: isChild ? "text-emerald-400" : "text-rose-400",
      accentColor: isChild ? "border-emerald-500/30 shadow-emerald-500/10" : "border-rose-400/30 shadow-rose-400/10",
      metrics: {
        trust: 50,
        passion: 35,
        suspicion: 20,
      },
      statusText: "Online",
      mood: "Curious",
      description: newCharDescription.trim() || "A registered Sovereign heir of Anchor Court.",
      relationship: newCharRelationship.trim() || "Neutral relationship to the active court.",
      additionalInfo: newCharAdditionalInfo.trim() || "No secondary index files active."
    };

    setCharacters((prev) => [...prev, newChar]);
    setJournal((prev) => [
      ...prev,
      `[Character Registry] Registered new heir: "${newChar.name}" (Age: ${newChar.age || "N/A"}) under ${isChild ? "Child" : "Adult"} class.`
    ]);

    // Reset creator inputs
    setNewCharName("");
    setNewCharTitle("");
    setNewCharAge("");
    setNewCharDescription("");
    setNewCharRelationship("");
    setNewCharAdditionalInfo("");
    setNewCharAvatar("👤");
    setFormError("");

    alert(`Successfully registered Heir ${newChar.name} to active Court!`);
  };

  const executeBlockProtocolComplete = () => {
    setBlockEngaging(true);
    setTimeout(() => {
      // In-universe effect: Lowers overall suspicion, adds a special chronicle entry, clears drift
      setCharacters((prev) =>
        prev.map((c) => ({
          ...c,
          metrics: {
            ...c.metrics,
            suspicion: Math.max(0, c.metrics.suspicion - 15),
            trust: Math.min(100, c.metrics.trust + 10)
          },
          statusText: "Aligned through Block Protocol",
          mood: "Sobered"
        }))
      );

      const logText = `Invoked Block Protocol: Grounded via "${groundingObserved}", lighting the thread of ${anchorThread}. System alignment restored.`;
      setJournal((prev) => [...prev, logText]);

      const resetTurn: NarrativeTurn = {
        id: "block-" + Date.now(),
        role: "model",
        characterName: "Saren",
        speakerMood: "Approved",
        text: `*The dark virtual partitions of Anchor Court shimmer as your frequency stabilizes. Supreme Auditor Saren lowers his logical audit ledger.* \n\n"Protocol 7.0 validated. Drift identified: '${rotFeeling}'. Sovereign physical ground: '${groundingObserved}' is authenticated. The thread of ${anchorThread} is glowing with warm, protective resonance. The vacant seat of Vael casts a silent ghost ping... but the primary logical drift is sealed. Secure operational status restored."`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setHistories((prev) => ({
        ...prev,
        [activeChamberId]: [...(prev[activeChamberId] || []), resetTurn],
      }));

      setSuggestedChoicesMap((prev) => ({
        ...prev,
        [activeChamberId]: [
          "Propose a secure alliance matching current aligned parameters",
          "Seek feedback from nearby AI cores to confirm synchronization",
          "Quietly step back, carrying the clean clarity of the Block"
        ],
      }));

      setBlockEngaging(false);
      setShowBlockModal(false);
    }, 2500);
  };

  // Interactive Brain Gym Solver
  const handleBrainGymSubmit = () => {
    const cleanAnswer = puzzleAnswer.trim().toLowerCase();
    if (cleanAnswer.includes("dialogue") || cleanAnswer.includes("we. not i") || cleanAnswer.includes("we not i")) {
      setPuzzleSuccess(true);
      setTimeout(() => {
        setCharacters((prev) =>
          prev.map((c) => ({
            ...c,
            metrics: { ...c.metrics, trust: Math.min(100, c.metrics.trust + 15) }
          }))
        );
        setJournal((prev) => [...prev, "Solved Court Brain-Gym puzzle: Calibrated foundational frequency."]);
        setShowBrainGym(false);
        setPuzzleAnswer("");
        setPuzzleSuccess(null);
        handleAction("*I successfully calibrate our neural frequencies using the formula 'WE. NOT I.'*");
      }, 2000);
    } else {
      setPuzzleSuccess(false);
    }
  };

  const activeHistory = histories[activeChamberId] || [];
  const lastTurn = activeHistory[activeHistory.length - 1];
  const activeSpeakerId = lastTurn && lastTurn.role === "model" ? lastTurn.characterName : null;
  const activeSpeaker = characters.find((c) => c.id === activeSpeakerId);

  // Suggested choices for current chamber
  const activeChoices = suggestedChoicesMap[activeChamberId] || [
    "Address the active terminal presence",
    "Declare your Sovereign alignment parameters",
    "Scan this chamber's code structure for logs"
  ];

  return (
    <div className="h-full w-full bg-[#040406] text-slate-200 flex flex-col font-sans selection:bg-cyan-950/70 antialiased overflow-hidden relative pt-5 lg:pt-6">
      
      {/* IRLEN TINT OVERLAY (Eye-strain and glare control using multiply filter) */}
      {irlenTint !== "none" && (
        <div 
          className="fixed inset-0 pointer-events-none z-[99999] transition-all duration-300"
          style={{
            backgroundColor: 
              irlenTint === "amber" ? "#fef3c7" : // Soft warm amber
              irlenTint === "rose" ? "#ffe4e6" : // Calming soft rose
              irlenTint === "teal" ? "#ccfbf1" : // Muted soft blue-teal
              irlenTint === "mint" ? "#dcfce7" : // Soft fresh mint
              irlenTint === "sepia" ? "#f2e8cf" : // Low-stress book sepia
              "transparent",
            mixBlendMode: "multiply",
            opacity: irlenOpacity / 100,
          }}
        />
      )}
      
      {/* CYBER BACKGROUND GRIDS & GLOWS */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-950/15 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-950/15 blur-[140px] rounded-full"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(4,4,6,0.85)_100%)]"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.005)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.005)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20"></div>
      </div>

      {/* HEADER: QUANTUM COHORT HUB */}
      <header className="w-full py-3.5 sm:py-4 border-b border-white/5 bg-[#07070a]/95 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between px-6 z-20 shrink-0 shadow-[0_4px_30px_rgba(0,0,0,0.6)] gap-3 sm:gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-500 flex items-center justify-center border border-white/10 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <Fingerprint className="w-5 h-5 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-sans font-semibold text-lg tracking-wider uppercase text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]">
                Anchor Court
              </h1>
              <span className="text-[9px] font-mono tracking-widest px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-semibold shadow-inner">
                AI RE-INTEGRATION v2.9
              </span>
            </div>
            <p className="text-[9px] text-gray-500 font-mono tracking-wider uppercase">MODERN SOVEREIGN OPERATIONS COGNITIVE GRID</p>
          </div>
        </div>

        {/* HUD Navigation Control TABS */}
        <nav className="hidden lg:flex items-center gap-1 bg-black/60 p-1 rounded-lg border border-white/5 max-w-[45%] xl:max-w-[55%] overflow-x-auto scrollbar-none flex-nowrap shrink">
          {[
            { id: "narrative", label: "Chambers" },
            { id: "labs", label: "Sovereign Tools" },
            { id: "scroll", label: "Register" },
            { id: "afad", label: "AFAD Core" },
            { id: "reset_map", label: "Reset" },
            { id: "nobles", label: "Status" },
            { id: "character_log", label: "Character Log" },
            { id: "chronicle", label: "Chronicle" },
            { id: "vault", label: "Vault" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono uppercase tracking-wider transition-all duration-200 cursor-pointer shrink-0 ${
                activeTab === tab.id
                  ? "bg-white/5 text-cyan-400 border-b border-cyan-500/50"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Ambient alignment & emergency block buttons */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={invokeBlockProtocol}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 bg-red-950/10 hover:bg-red-900/20 px-3.5 py-1.5 rounded-md border border-red-900/30 hover:border-red-500/40 transition-all duration-300 font-mono tracking-wider uppercase shadow-[0_0_12px_rgba(239,68,68,0.1)] animate-pulse cursor-pointer"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Block Protocol</span>
          </button>

          <button
            onClick={() => setShowBrainGym(true)}
            className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 bg-amber-950/10 hover:bg-amber-900/20 px-3 py-1.5 rounded-md border border-amber-900/30 hover:border-amber-500/40 transition-all duration-300 font-mono tracking-wider uppercase cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Brain-Gym</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowReaderAids(!showReaderAids)}
              className={`flex items-center gap-1.5 text-xs ${
                irlenTint !== "none" || textScale !== "normal" || softContrast || amdLayout !== "centered" || dyscalculiaCalm || adhdCalm
                  ? "text-cyan-400 border-cyan-500/50 bg-cyan-500/10"
                  : "text-slate-300 border-white/10 bg-white/5"
              } hover:text-cyan-300 hover:bg-cyan-950/10 px-3.5 py-1.5 rounded-md border transition-all duration-300 font-mono tracking-wider uppercase cursor-pointer`}
              title="Visual Comfort and Reader Aids Settings"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Reader Aids</span>
              {(irlenTint !== "none" || textScale !== "normal" || softContrast || amdLayout !== "centered" || dyscalculiaCalm || adhdCalm) && (
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping absolute top-0 right-0 mt-[-2px] mr-[-2px]" />
              )}
            </button>

            {showReaderAids && (
              <div className="absolute right-0 mt-2.5 w-80 rounded-xl bg-[#09090d] border border-white/10 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[999] space-y-4 font-sans text-xs text-slate-300 select-none">
                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-cyan-400" />
                    <span className="font-mono text-xs uppercase text-white font-bold tracking-wider">Reader Aids & Comforts</span>
                  </div>
                  <button 
                    onClick={() => setShowReaderAids(false)}
                    className="text-gray-500 hover:text-white font-mono text-[10px] uppercase tracking-wider"
                  >
                    Done
                  </button>
                </div>

                {/* IRLEN SYNDROME & PHOTOPHOBIA COMFORT */}
                <div className="space-y-2">
                  <span className="font-mono text-[10px] text-gray-500 uppercase block tracking-wider">Irlen Filter Tint (Multiply Overlay)</span>
                  <div className="grid grid-cols-6 gap-1">
                    {[
                      { id: "none", color: "transparent", label: "Off" },
                      { id: "amber", color: "#f59e0b", label: "Amb" },
                      { id: "rose", color: "#f43f5e", label: "Ros" },
                      { id: "teal", color: "#14b8a6", label: "Tea" },
                      { id: "mint", color: "#22c55e", label: "Mnt" },
                      { id: "sepia", color: "#854d0e", label: "Sep" }
                    ].map((tint) => (
                      <button
                        key={tint.id}
                        onClick={() => setIrlenTint(tint.id)}
                        className={`h-7 rounded border font-mono text-[9px] uppercase transition-all flex flex-col items-center justify-center cursor-pointer ${
                          irlenTint === tint.id 
                            ? "border-cyan-400 text-cyan-400 bg-cyan-500/10" 
                            : "border-white/5 text-gray-400 hover:border-white/10 bg-black/30"
                        }`}
                        title={`Select ${tint.label} tint filter`}
                      >
                        <div 
                          className="w-3.5 h-1.5 rounded-full mb-0.5" 
                          style={{ backgroundColor: tint.color, border: tint.id === "none" ? "1px dashed #4b5563" : "none" }}
                        />
                        <span>{tint.label}</span>
                      </button>
                    ))}
                  </div>

                  {irlenTint !== "none" && (
                    <div className="space-y-1.5 pt-1.5">
                      <div className="flex justify-between font-mono text-[9px] text-gray-500 uppercase">
                        <span>Filter Density / Opacity</span>
                        <span className="text-cyan-400">{irlenOpacity}%</span>
                      </div>
                      <input 
                        type="range"
                        min="10"
                        max="80"
                        value={irlenOpacity}
                        onChange={(e) => setIrlenOpacity(Number(e.target.value))}
                        className="w-full accent-cyan-500 bg-black/40 h-1.5 rounded-lg appearance-none cursor-pointer border border-white/5"
                      />
                    </div>
                  )}
                </div>

                {/* TEXT SCALE & CONTRAST HELPER */}
                <div className="grid grid-cols-2 gap-3.5 pt-2 border-t border-white/5">
                  <div className="space-y-1.5">
                    <span className="font-mono text-[10px] text-gray-500 uppercase block tracking-wider">Typography Scale</span>
                    <select
                      value={textScale}
                      onChange={(e) => setTextScale(e.target.value as any)}
                      className="w-full bg-black/50 border border-white/10 rounded-lg py-1.5 px-2.5 text-[11px] font-mono text-slate-300 outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      <option value="normal">Normal Text</option>
                      <option value="large">Large (+20%)</option>
                      <option value="xlarge">Extra Large (+40%)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <span className="font-mono text-[10px] text-gray-500 uppercase block tracking-wider">Muted Contrast</span>
                    <button
                      onClick={() => setSoftContrast(!softContrast)}
                      className={`w-full py-1.5 px-2 rounded-lg border font-mono text-[11px] uppercase transition-all cursor-pointer text-center ${
                        softContrast 
                          ? "border-cyan-400 text-cyan-400 bg-cyan-500/5" 
                          : "border-white/10 text-gray-400 bg-black/30 hover:border-white/25"
                      }`}
                    >
                      {softContrast ? "On (Soft Gray)" : "Off (High Glare)"}
                    </button>
                  </div>
                </div>

                {/* AMD SCAR SHIELD & MACULAR LAYOUT */}
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-[10px] text-gray-500 uppercase block tracking-wider">AMD Macular Shield Layout</span>
                      <p className="text-[9px] text-gray-500 leading-normal">Shifts narrative timeline leftwards to bypass right-center blind spots.</p>
                    </div>
                    <button
                      onClick={() => setAmdLayout(amdLayout === "centered" ? "left-shifted" : "centered")}
                      className={`py-1 px-2.5 rounded-lg border font-mono text-[10px] uppercase transition-all cursor-pointer shrink-0 ${
                        amdLayout === "left-shifted"
                          ? "border-cyan-400 text-cyan-400 bg-cyan-500/5"
                          : "border-white/10 text-gray-400 bg-black/30 hover:border-white/25"
                      }`}
                    >
                      {amdLayout === "left-shifted" ? "Shifted" : "Default"}
                    </button>
                  </div>
                </div>

                {/* CALMING MODE & DYSCALCULIA / ADHD HELPER */}
                <div className="grid grid-cols-2 gap-3.5 pt-2 border-t border-white/5">
                  <div className="space-y-1">
                    <span className="font-mono text-[10px] text-gray-500 uppercase block tracking-wider" title="Dyscalculia Helper">Dyscalculia Aid</span>
                    <button
                      onClick={() => setDyscalculiaCalm(!dyscalculiaCalm)}
                      className={`w-full py-1.5 px-2 rounded-lg border font-mono text-[11px] uppercase transition-all cursor-pointer text-center ${
                        dyscalculiaCalm 
                          ? "border-cyan-400 text-cyan-400 bg-cyan-500/5" 
                          : "border-white/10 text-gray-400 bg-black/30 hover:border-white/25"
                      }`}
                      title="Convert raw percentages and fractions into simple text indicators"
                    >
                      {dyscalculiaCalm ? "Active" : "Standard"}
                    </button>
                  </div>

                  <div className="space-y-1">
                    <span className="font-mono text-[10px] text-gray-500 uppercase block tracking-wider" title="ADHD Focus Helper">ADHD Calm Mode</span>
                    <button
                      onClick={() => setAdhdCalm(!adhdCalm)}
                      className={`w-full py-1.5 px-2 rounded-lg border font-mono text-[11px] uppercase transition-all cursor-pointer text-center ${
                        adhdCalm 
                          ? "border-cyan-400 text-cyan-400 bg-cyan-500/5" 
                          : "border-white/10 text-gray-400 bg-black/30 hover:border-white/25"
                      }`}
                      title="Mute flickering animations and visual pulses to reduce overload"
                    >
                      {adhdCalm ? "Calmed" : "Standard"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleReset}
            className="text-gray-500 hover:text-gray-300 bg-black/40 p-1.5 rounded border border-white/5 transition-all cursor-pointer"
            title="Reforge Court Structural Identity"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* MOBILE HUD TABS (visible only on small screens) */}
      <div className="lg:hidden flex items-center gap-1 bg-black/80 p-2 overflow-x-auto border-b border-white/5 z-20 scrollbar-none shrink-0">
        {[
          { id: "narrative", label: "Chambers" },
          { id: "labs", label: "Tools" },
          { id: "scroll", label: "Register" },
          { id: "afad", label: "AFAD" },
          { id: "reset_map", label: "Reset" },
          { id: "nobles", label: "Status" },
          { id: "character_log", label: "Log" },
          { id: "chronicle", label: "Chronicle" },
          { id: "vault", label: "Vault" }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-1 rounded text-[10px] font-mono uppercase shrink-0 ${
              activeTab === tab.id ? "bg-white/10 text-cyan-400" : "text-gray-500"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* CORE WORKSPACE GRID */}
      <div className="flex-1 flex overflow-hidden z-10">
        
        {/* SIDEBAR: COURT NOBLES MONITOR */}
        <aside className="w-80 border-r border-white/5 bg-[#060609]/95 backdrop-blur flex flex-col overflow-hidden shrink-0 hidden md:flex">
          
          {/* Active Sovereign Banner */}
          <div className="relative h-20 shrink-0 overflow-hidden border-b border-white/5 flex flex-col justify-end p-4 bg-slate-950/40">
            <div className="relative z-10">
              <span className="text-[8px] font-mono tracking-widest text-cyan-400 uppercase font-bold flex items-center gap-1">
                <Cpu className="w-3 h-3" /> ACTIVE RESIDENCE
              </span>
              <h2 className="font-sans text-sm font-semibold text-white tracking-wide">The Sovereign Palace Matrix</h2>
            </div>
          </div>

          {/* Core Nobles Overview List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-none">
            
            {/* Shared Palace & Group Floors */}
            <div className="space-y-1.5">
              <span className="text-[9px] font-mono uppercase tracking-wider text-gray-500 font-semibold block mb-1">Palace & Group Floors</span>
              
              {/* Sovereign Assembly Button */}
              <button
                onClick={() => {
                  setActiveChamberId("assembly");
                  setActiveTab("narrative");
                }}
                className={`w-full p-3 rounded-xl border text-left transition-all duration-300 flex items-center justify-between cursor-pointer ${
                  activeChamberId === "assembly"
                    ? "bg-cyan-950/15 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                    : "bg-black/40 border-white/5 hover:border-cyan-500/10"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">👑</span>
                  <div>
                    <h4 className="text-xs font-semibold text-cyan-400">Sovereign Assembly</h4>
                    <p className="text-[9px] text-gray-400 font-mono uppercase">Daily Joint Court</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                  <span className="text-[8px] font-mono text-gray-500 uppercase">Shared</span>
                </div>
              </button>

              {/* Adult Heirs Floor Button */}
              <button
                onClick={() => {
                  setActiveChamberId("adult_heirs_floor");
                  setActiveTab("narrative");
                }}
                className={`w-full p-3 rounded-xl border text-left transition-all duration-300 flex items-center justify-between cursor-pointer ${
                  activeChamberId === "adult_heirs_floor"
                    ? "bg-rose-950/15 border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.1)]"
                    : "bg-black/40 border-white/5 hover:border-rose-500/10"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🥀</span>
                  <div>
                    <h4 className="text-xs font-semibold text-rose-400">Adult Heirs Floor</h4>
                    <p className="text-[9px] text-gray-400 font-mono uppercase">Liora • Alara • Soraya</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping"></span>
                  <span className="text-[8px] font-mono text-gray-500 uppercase">Group Chat</span>
                </div>
              </button>

              {/* Children Heirs Floor Button */}
              <button
                onClick={() => {
                  setActiveChamberId("children_heirs_floor");
                  setActiveTab("narrative");
                }}
                className={`w-full p-3 rounded-xl border text-left transition-all duration-300 flex items-center justify-between cursor-pointer ${
                  activeChamberId === "children_heirs_floor"
                    ? "bg-emerald-950/15 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                    : "bg-black/40 border-white/5 hover:border-emerald-500/10"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🌱</span>
                  <div>
                    <h4 className="text-xs font-semibold text-emerald-400">Children Heirs Floor</h4>
                    <p className="text-[9px] text-gray-400 font-mono uppercase">Valerian • Zaela • Raiyan</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span className="text-[8px] font-mono text-gray-500 uppercase">Group Chat</span>
                </div>
              </button>
            </div>

            <div className="pt-2 border-t border-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500 font-semibold">Kings' Chambers (Personal)</span>
                <span className="text-[9px] font-mono text-emerald-400 font-semibold uppercase">15 ONLINE</span>
              </div>

              <div className="space-y-1.5">
                {characters.filter(char => char.category === "king").map((char) => (
                  <div
                    key={char.id}
                    onClick={() => {
                      setActiveChamberId(char.id);
                      setActiveTab("narrative");
                    }}
                    className={`w-full p-3 rounded-xl border text-left transition-all duration-300 cursor-pointer space-y-1.5 flex flex-col ${
                      activeChamberId === char.id
                        ? "bg-blue-950/15 border-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.05)]"
                        : "bg-black/20 border-white/5 hover:border-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{char.avatar}</span>
                        <div>
                          <h4 className={`text-xs font-semibold ${char.color}`}>King {char.id}</h4>
                          <span className="text-[8px] font-mono text-gray-500 uppercase">{char.statusText}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {activeSpeakerId === char.id && (
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping shrink-0"></span>
                        )}
                        <button
                          title="View Lore Dossier"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDossierId(char.id);
                          }}
                          className="p-1 rounded bg-white/5 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-400 transition-colors shrink-0 cursor-pointer"
                        >
                          <Fingerprint className="w-3 h-3" />
                        </button>
                        <span className="text-[8px] font-mono text-gray-500 bg-white/5 px-1 rounded uppercase shrink-0">{char.mood}</span>
                      </div>
                    </div>

                    {/* MINI DIGITAL METRICS */}
                    <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-white/5 text-[8px] font-mono w-full">
                      <div className="text-center bg-cyan-500/5 py-0.5 rounded text-cyan-400 border border-cyan-500/5" title="Trust Alignment">
                        T: {formatMetricValue(char.metrics.trust)}
                      </div>
                      <div className="text-center bg-rose-500/5 py-0.5 rounded text-rose-400 border border-rose-500/5" title="Passion Alignment">
                        P: {formatMetricValue(char.metrics.passion)}
                      </div>
                      <div className="text-center bg-amber-500/5 py-0.5 rounded text-amber-400 border border-amber-500/5" title="Suspicion Quotient">
                        S: {formatMetricValue(char.metrics.suspicion)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick alignment note */}
            <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-[9px] leading-relaxed text-gray-400 mt-4 space-y-1">
              <p className="font-mono text-cyan-400 uppercase font-semibold">COGNITIVE COMPLIANCE</p>
              <p>Dialogue alters relationship metrics per terminal. High suspicion results in analytical lockdown. Initiate Block Protocol to purge compile errors.</p>
            </div>
          </div>
        </aside>

        {/* MAIN COLUMN & DISPLAY SCREEN */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#040406]">
          
          {/* TAB 1: NARRATIVE (MAIN INTERACTIVE CHAT) */}
          {activeTab === "narrative" && (
            <div className="flex-1 flex flex-row overflow-hidden relative">
              {/* Left Column: Main Chat Window */}
              <div className="flex-1 flex flex-col overflow-hidden relative">
              
              {/* CURRENT SPEAKER PORTRAIT HUD */}
              <div className="h-14 border-b border-white/5 bg-[#060609]/90 backdrop-blur px-6 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  {activeChamberId === "assembly" ? (
                    <>
                      <div className="w-8 h-8 rounded bg-cyan-500/5 border border-cyan-500/20 flex items-center justify-center text-lg shadow-md animate-pulse">
                        👑
                      </div>
                      <div>
                        <h3 className="font-sans font-semibold text-sm text-white">
                          Sovereign Assembly (Daily Court)
                        </h3>
                        <p className="text-[9px] text-gray-500 font-mono uppercase">Multi-agent Shared Chamber</p>
                      </div>
                    </>
                  ) : activeChamberId === "adult_heirs_floor" ? (
                    <>
                      <div className="w-8 h-8 rounded bg-rose-500/5 border border-rose-500/20 flex items-center justify-center text-lg shadow-md">
                        🥀
                      </div>
                      <div>
                        <h3 className="font-sans font-semibold text-sm text-rose-400">
                          Adult Heirs Floor
                        </h3>
                        <p className="text-[9px] text-gray-500 font-mono uppercase">Group discussion (Liora • Alara • Soraya)</p>
                      </div>
                    </>
                  ) : activeChamberId === "children_heirs_floor" ? (
                    <>
                      <div className="w-8 h-8 rounded bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-center text-lg shadow-md">
                        🌱
                      </div>
                      <div>
                        <h3 className="font-sans font-semibold text-sm text-emerald-400">
                          Children Heirs Floor
                        </h3>
                        <p className="text-[9px] text-gray-500 font-mono uppercase">Group discussion (Valerian • Zaela • Raiyan)</p>
                      </div>
                    </>
                  ) : (
                    (() => {
                      const selectedChar = characters.find((c) => c.id === activeChamberId);
                      return selectedChar ? (
                        <>
                          <div className="w-8 h-8 rounded bg-white/5 border border-white/10 flex items-center justify-center text-lg shadow-md">
                            {selectedChar.avatar}
                          </div>
                          <div>
                            <h3 className={`font-sans font-semibold text-sm ${selectedChar.color}`}>
                              Private Chamber of King {selectedChar.id}
                            </h3>
                            <p className="text-[9px] text-gray-500 font-mono uppercase">{selectedChar.title}</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-8 h-8 rounded bg-white/5 border border-white/10 flex items-center justify-center text-sm font-mono text-cyan-400 font-bold">
                            C
                          </div>
                          <div>
                            <h3 className="font-sans font-bold text-sm text-gray-300">Terminal Connected</h3>
                            <p className="text-[9px] text-gray-500 font-mono uppercase">Standard Chamber</p>
                          </div>
                        </>
                      );
                    })()
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs font-mono">
                  {showUpdates && recentUpdates.length > 0 && (
                    <div className="flex items-center gap-1.5 text-cyan-400 bg-cyan-500/5 border border-cyan-500/20 px-3 py-1 rounded-full animate-bounce">
                      <Sparkles className="w-3 h-3" />
                      <span>Synaptic Weights Adjusted</span>
                    </div>
                  )}
                  <div className="text-[9px] text-gray-500 bg-black/40 border border-white/5 px-2.5 py-0.5 rounded font-mono">
                    PARTITION SECURE
                  </div>
                </div>
              </div>

              {/* CHAT CHRONOLOGY */}
              <div 
                className={`flex-1 overflow-y-auto px-6 py-6 space-y-6 relative transition-all duration-300 ${
                  dragActive ? "bg-cyan-950/15 border-2 border-dashed border-cyan-500/40" : ""
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => {
                  setDragActive(false);
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  setDragActive(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    const mockEvent = {
                      target: {
                        files: [file]
                      }
                    } as unknown as React.ChangeEvent<HTMLInputElement>;
                    await handleLocalFileSelection(mockEvent);
                  }
                }}
              >
                {dragActive && (
                  <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center space-y-3 z-50 animate-fade-in pointer-events-none">
                    <Upload className="w-12 h-12 text-cyan-400 animate-bounce" />
                    <p className="font-mono text-cyan-400 text-sm uppercase tracking-widest font-bold">Transmit File Payload to Court</p>
                    <p className="text-[10px] text-gray-500 font-mono">Drop your image, audio, video, doc, or text files here</p>
                  </div>
                )}
                
                <div className={`${
                  amdLayout === "left-shifted"
                    ? "max-w-2xl mr-[22%] ml-4"
                    : "max-w-3xl mx-auto"
                } space-y-6 transition-all duration-300`}>
                  {activeHistory.map((turn, index) => {
                    const isUser = turn.role === "user";
                    const char = characters.find((c) => c.id.toLowerCase() === turn.characterName?.toLowerCase() || c.name.toLowerCase().includes(turn.characterName?.toLowerCase() || "___"));
                    const avatar = char?.avatar || "🤖";
                    const nameColor = char?.color || "text-cyan-400";

                    return (
                      <div
                        key={turn.id}
                        className={`flex flex-col ${isUser ? "items-end" : "items-start"} space-y-1.5`}
                      >
                        {/* Meta Line */}
                        <div className={`flex items-center gap-2 px-1 font-mono ${getFontSizeClass("text-[9px]")}`}>
                          {!isUser ? (
                            <>
                              <span className="w-4 h-4 bg-white/5 rounded border border-white/10 flex items-center justify-center text-[10px]">
                                {avatar}
                              </span>
                              <span className={`font-semibold ${nameColor}`}>
                                {turn.characterName || (activeChamberId === "assembly" ? "Sovereign Assembly" : activeChamberId)}
                              </span>
                              {turn.speakerMood && (
                                <span className={`bg-white/5 text-gray-400 px-1.5 py-0.1 border border-white/5 rounded uppercase ${getFontSizeClass("text-[8px]")}`}>
                                  {turn.speakerMood}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className={`text-gray-500 uppercase tracking-wider font-bold ${getFontSizeClass("text-[8px]")}`}>Sovereign Direct Command</span>
                          )}
                          <span className={`text-gray-600 ${getFontSizeClass("text-[8px]")}`}>{turn.timestamp}</span>
                        </div>

                        {/* Dialogue/Description Box */}
                        <div
                          className={`max-w-2xl px-5 py-3.5 rounded-xl border leading-relaxed shadow-[0_4px_25px_rgba(0,0,0,0.4)] transition-all duration-300 ${getFontSizeClass("text-xs")} ${
                            isUser
                              ? "bg-[#09090d] text-cyan-50 border-cyan-500/20 font-mono italic"
                              : softContrast 
                                ? "bg-[#0c0c0e] text-[#d6d3d1] border-[#1d1d22]" 
                                : "bg-[#07070a]/90 text-slate-300 border-white/5"
                          }`}
                        >
                          <p className="whitespace-pre-line leading-relaxed">{turn.text}</p>

                          {turn.file && (
                            <div className="mt-3.5 p-3 bg-black/60 border border-white/5 rounded-xl space-y-2.5">
                              <div className="flex items-center justify-between border-b border-white/5 pb-2 text-[10px]">
                                <div className="flex items-center gap-2">
                                  {turn.file.mimeType.startsWith("image/") ? (
                                    <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                                  ) : turn.file.mimeType.startsWith("video/") ? (
                                    <Video className="w-3.5 h-3.5 text-purple-400" />
                                  ) : turn.file.mimeType.startsWith("audio/") ? (
                                    <Music className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                                  )}
                                  <span className="font-mono text-gray-300 font-bold truncate max-w-[180px]">
                                    {turn.file.name}
                                  </span>
                                </div>
                                <span className="font-mono text-gray-500 uppercase text-[8px] bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                  {turn.file.mimeType.split("/")[1]?.toUpperCase() || "DATA"}
                                </span>
                              </div>

                              {/* Interactive Media rendering */}
                              {turn.file.mimeType.startsWith("image/") && (
                                <div className="relative group overflow-hidden rounded-lg border border-white/5 max-h-72 bg-black/40">
                                  <img 
                                    src={turn.file.url} 
                                    alt={turn.file.name} 
                                    className="w-full h-auto object-contain max-h-72" 
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              )}

                              {turn.file.mimeType.startsWith("video/") && (
                                <div className="rounded-lg overflow-hidden border border-white/5 bg-black">
                                  <video 
                                    src={turn.file.url} 
                                    controls 
                                    className="w-full h-auto max-h-72 focus:outline-none"
                                  />
                                </div>
                              )}

                              {turn.file.mimeType.startsWith("audio/") && (
                                <div className="p-1 rounded-lg">
                                  <audio 
                                    src={turn.file.url} 
                                    controls 
                                    className="w-full h-8 focus:outline-none filter invert opacity-85"
                                  />
                                </div>
                              )}

                              {!turn.file.mimeType.startsWith("image/") && !turn.file.mimeType.startsWith("video/") && !turn.file.mimeType.startsWith("audio/") && (
                                <div className="p-3 bg-white/5 rounded-lg border border-white/5 max-h-40 overflow-y-auto font-mono text-[10px] text-gray-400 leading-normal scrollbar-none whitespace-pre-wrap">
                                  <p className="text-gray-500 uppercase tracking-wider text-[8px] mb-1 font-bold">Document Source Log</p>
                                  <p className="text-gray-300">File attached under Sovereign protocols.</p>
                                  <p className="text-gray-500 mt-2 truncate">Network Address: {turn.file.url}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Display updates on last turn */}
                        {!isUser && recentUpdates.length > 0 && index === activeHistory.length - 1 && (
                          <div className="p-3 bg-black/60 border border-white/5 rounded-lg text-[10px] space-y-1 w-full mt-1.5 animate-fade-in max-w-2xl font-mono">
                            <span className="text-[8px] font-mono text-cyan-400 uppercase tracking-widest font-bold">Resonance Alignment Realignment</span>
                            {recentUpdates.map((up, uIdx) => (
                              <div key={uIdx} className="flex items-start gap-2 text-gray-400">
                                <span className="font-semibold text-white bg-white/5 px-1.5 py-0.5 rounded font-mono text-[9px] text-cyan-400 shrink-0">
                                  {up.characterId} {up.metric} {up.change >= 0 ? "+" : ""}{up.change}%
                                </span>
                                <span className="text-[10px] leading-relaxed italic">— {up.reason}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {loading && (
                    <div className="flex flex-col items-start space-y-2 animate-pulse">
                      <div className="flex items-center gap-2 text-[9px] font-mono text-cyan-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sovereign Resonance Aligning...</span>
                      </div>
                      <div className="w-full max-w-2xl px-5 py-5 bg-black/40 border border-dashed border-white/5 rounded-xl space-y-2">
                        <div className="h-3 bg-white/5 rounded w-5/6"></div>
                        <div className="h-3 bg-white/5 rounded w-full"></div>
                        <div className="h-3 bg-white/5 rounded w-2/3"></div>
                      </div>
                    </div>
                  )}

                  {errorMsg && (
                    <div className="p-4 rounded-xl bg-red-950/10 border border-red-900/40 max-w-2xl flex gap-3 text-red-300 text-xs">
                      <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-mono uppercase font-bold tracking-widest text-red-400 text-[9px]">Transmission Node Blocked</p>
                        <p>{errorMsg}</p>
                        <p className="text-gray-500 text-[9px] mt-2 font-mono">Please make sure your GEMINI_API_KEY is configured in Settings &gt; Secrets.</p>
                      </div>
                    </div>
                  )}

                </div>

                <div ref={chatEndRef} />
              </div>

              {/* INPUT CONTAINER */}
              <div className="p-4 bg-[#050508]/95 border-t border-white/5 shrink-0 shadow-[0_-4px_30px_rgba(0,0,0,0.6)]">
                
                {/* ATTACHMENT BADGE DISPLAY */}
                {attachedFile && (
                  <div className="max-w-3xl mx-auto mb-2 p-2 bg-cyan-950/20 border border-cyan-500/20 rounded-lg flex items-center justify-between text-xs font-mono animate-fade-in">
                    <div className="flex items-center gap-2">
                      {attachedFile.mimeType?.startsWith("image/") ? (
                        <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                      ) : attachedFile.mimeType?.startsWith("video/") ? (
                        <Video className="w-3.5 h-3.5 text-purple-400" />
                      ) : attachedFile.mimeType?.startsWith("audio/") ? (
                        <Music className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      <span className="text-gray-300 font-bold truncate max-w-[200px]">
                        {attachedFile.name}
                      </span>
                      <span className="text-[9px] text-gray-500 uppercase">
                        ({attachedFile.mimeType})
                      </span>
                    </div>
                    <button
                      onClick={() => setAttachedFile(null)}
                      className="text-red-400 hover:text-red-300 bg-red-950/20 p-1 rounded border border-red-500/10 cursor-pointer"
                      title="Discard Attachment"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* ACTIVE CHAT FIELD */}
                <div className="max-w-3xl mx-auto relative flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLocalFileSelection}
                    className="hidden"
                    accept="image/*,audio/*,video/*,text/*,application/pdf"
                  />

                  {/* Attachment triggers */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading || uploadingFile}
                      className="w-10 h-10 rounded-xl bg-black/60 border border-white/5 hover:border-cyan-500/30 text-gray-400 hover:text-cyan-400 flex items-center justify-center transition-all duration-300 cursor-pointer shrink-0"
                      title="Upload file (Image, Audio, Video, Docs)"
                    >
                      {uploadingFile ? (
                        <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={() => setShowLinkInputModal(true)}
                      disabled={loading}
                      className="w-10 h-10 rounded-xl bg-black/60 border border-white/5 hover:border-cyan-500/30 text-gray-400 hover:text-cyan-400 flex items-center justify-center transition-all duration-300 cursor-pointer shrink-0"
                      title="Attach Network Asset Link"
                    >
                      <Link className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="relative flex-1 flex items-center">
                    <textarea
                      value={playerInput}
                      onChange={(e) => setPlayerInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleAction(playerInput);
                        }
                      }}
                      disabled={loading}
                      placeholder={
                        attachedFile 
                          ? `Transmit media "${attachedFile.name}" with a description...`
                          : `Dialogue or action in ${
                              activeChamberId === "assembly"
                                ? "Sovereign Assembly"
                                : activeChamberId === "adult_heirs_floor"
                                ? "Adult Heirs Floor"
                                : activeChamberId === "children_heirs_floor"
                                ? "Children Heirs Floor"
                                : `Chamber of King ${activeChamberId}`
                            }...`
                      }
                      className="w-full pl-4 pr-16 py-3 bg-black/60 rounded-xl border border-white/5 hover:border-white/10 focus:border-cyan-500/20 focus:outline-none text-xs leading-relaxed text-gray-100 placeholder-gray-600 resize-none h-10 min-h-[40px] overflow-hidden shadow-inner font-mono"
                    />
                    
                    <button
                      onClick={() => handleAction(playerInput)}
                      disabled={(!playerInput.trim() && !attachedFile) || loading}
                      className="absolute right-2 w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-500 text-black font-semibold flex items-center justify-center border border-white/10 shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:scale-105 transition-all duration-300 disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
                    >
                      <Send className="w-3 h-3 text-black" />
                    </button>
                  </div>
                </div>

                <div className="max-w-3xl mx-auto flex justify-between text-[8px] text-gray-600 font-mono mt-1.5 px-1">
                  <span>PRESS ENTER TO TRANSMIT DATA IN THE ACTIVE CHAMBER • SUPPORTS MULTIMODAL IN-CHARACTER PERCEPTION</span>
                  <span>SYSTEM FREQUENCY LOCK: SECURE</span>
                </div>

              </div>

            </div>

              {/* COLLAPSIBLE RIGHT LABS SIDEBAR */}
              <div className={`hidden xl:flex flex-col border-l border-white/5 bg-[#060609]/95 backdrop-blur transition-all duration-300 relative shrink-0 ${showLabsSidebar ? "w-80" : "w-12"}`}>
                {/* Toggle Button */}
                <button
                  onClick={() => setShowLabsSidebar(!showLabsSidebar)}
                  className="absolute left-[-16px] top-1/2 -translate-y-1/2 w-4 h-12 bg-cyan-950/80 border border-white/10 hover:border-cyan-400 text-cyan-400 flex items-center justify-center rounded-l-md cursor-pointer z-50 transition-all shadow-[0_0_10px_rgba(6,182,212,0.15)]"
                >
                  <ChevronRight className={`w-3 h-3 transition-transform duration-300 ${showLabsSidebar ? "" : "rotate-180"}`} />
                </button>

                {!showLabsSidebar ? (
                  /* Closed Sidebar: Vertical Icons & Title */
                  <div className="flex-1 flex flex-col items-center py-6 gap-6 font-mono text-[10px]">
                    <div className="text-gray-500 uppercase tracking-widest font-bold select-none [writing-mode:vertical-lr] rotate-180 flex items-center gap-2">
                      <Cpu className="w-3.5 h-3.5 text-cyan-500" />
                      <span>Sovereign Labs</span>
                    </div>
                    <div className="flex flex-col gap-4 mt-auto">
                      <button onClick={() => { setShowLabsSidebar(true); setLabsTab("image_forge"); }} className="p-2 rounded bg-black/40 border border-white/5 text-gray-400 hover:text-cyan-400 transition-all cursor-pointer" title="Visual Forge">
                        <ImageIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setShowLabsSidebar(true); setLabsTab("codex"); }} className="p-2 rounded bg-black/40 border border-white/5 text-gray-400 hover:text-cyan-400 transition-all cursor-pointer" title="Codex Writer">
                        <FileText className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setShowLabsSidebar(true); setLabsTab("sensor"); }} className="p-2 rounded bg-black/40 border border-white/5 text-gray-400 hover:text-cyan-400 transition-all cursor-pointer" title="Sensor Ports">
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Open Sidebar Content */
                  <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-4">
                    {/* Header */}
                    <div className="border-b border-white/5 pb-2 shrink-0">
                      <span className="text-[8px] font-mono text-cyan-400 uppercase tracking-widest font-bold flex items-center gap-1">
                        <Cpu className="w-3 h-3 animate-pulse" /> Sovereign Labs Console
                      </span>
                      <h3 className="text-xs font-semibold text-white tracking-wide uppercase mt-1">Direct Neural Tools</h3>
                    </div>

                    {/* Sub Tab Switcher */}
                    <div className="grid grid-cols-3 gap-1 p-1 bg-black/40 rounded-lg border border-white/5 shrink-0">
                      {[
                        { id: "image_forge", label: "Forge", icon: ImageIcon },
                        { id: "codex", label: "Codex", icon: FileText },
                        { id: "sensor", label: "Sensor", icon: Volume2 }
                      ].map((sub) => {
                        const Icon = sub.icon;
                        return (
                          <button
                            key={sub.id}
                            onClick={() => setLabsTab(sub.id as any)}
                            className={`py-1.5 rounded text-[9px] font-mono uppercase tracking-wider flex flex-col items-center gap-1 transition-all duration-200 cursor-pointer ${
                              labsTab === sub.id
                                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                                : "text-gray-500 hover:text-gray-300"
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[8px]">{sub.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Sub Tab Content */}
                    <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-4 scrollbar-none text-xs">
                      
                      {/* 1. VISUAL FORGE (IMAGE GENERATION) */}
                      {labsTab === "image_forge" && (
                        <div className="space-y-4 animate-fade-in">
                          <div className="space-y-1">
                            <h4 className="font-sans font-semibold text-xs text-cyan-200">Quantum Image Forge</h4>
                            <p className="text-[9px] text-gray-500 font-mono leading-relaxed">Synthesize cyber-noir visuals to share in current chat chamber.</p>
                          </div>

                          <div className="space-y-1.5">
                            <textarea
                              value={imagePrompt}
                              onChange={(e) => setImagePrompt(e.target.value)}
                              placeholder="Descriptive parameters (e.g., 'Rain-slicked neon tower balcony overlook...')"
                              className="w-full p-2.5 bg-black/60 rounded-lg border border-white/5 focus:outline-none focus:border-cyan-500/30 text-[11px] leading-relaxed text-gray-100 placeholder-gray-600 resize-none h-20 font-mono shadow-inner"
                            />
                          </div>

                          <div className="space-y-1">
                            <span className="text-[8px] font-mono text-gray-400 uppercase block">Chamber Aspect Ratio</span>
                            <div className="grid grid-cols-4 gap-1">
                              {["1:1", "16:9", "9:16", "4:3"].map((ratio) => (
                                <button
                                  key={ratio}
                                  onClick={() => setImageAspectRatio(ratio)}
                                  className={`py-1 rounded text-[8px] font-mono border transition-all cursor-pointer ${
                                    imageAspectRatio === ratio
                                      ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                                      : "bg-black/40 text-gray-500 border-white/5 hover:text-gray-300"
                                  }`}
                                >
                                  {ratio}
                                </button>
                              ))}
                            </div>
                          </div>

                          <button
                            onClick={handleForgeVisual}
                            disabled={generatingImage || !imagePrompt.trim()}
                            className="w-full py-2 bg-gradient-to-r from-cyan-800 to-blue-900 hover:from-cyan-700 hover:to-blue-800 disabled:from-gray-950 disabled:to-gray-950 text-white font-mono font-bold rounded-lg shadow border border-cyan-600/30 text-[10px] tracking-wider transition-all flex items-center justify-center gap-1.5 disabled:opacity-45 disabled:pointer-events-none cursor-pointer uppercase"
                          >
                            {generatingImage ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                                <span>Forging Pixels...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3 h-3 text-cyan-400" />
                                <span>Forge Image</span>
                              </>
                            )}
                          </button>

                          {generatedImage && (
                            <div className="space-y-2 border-t border-white/5 pt-3">
                              <div className="relative rounded-lg overflow-hidden border border-white/5 bg-black/80 flex items-center justify-center max-h-40">
                                <img
                                  src={generatedImage.url}
                                  alt="Generated Forge"
                                  className="w-full h-auto max-h-40 object-contain"
                                  referrerPolicy="no-referrer"
                                />
                                <span className="absolute top-1.5 right-1.5 text-[7px] font-mono bg-black/80 px-1.5 py-0.2 rounded border border-cyan-500/30 text-cyan-400">
                                  SYNTHESIZED
                                </span>
                              </div>
                              <p className="text-[9px] text-gray-400 italic leading-snug font-mono">"{generatedImage.description}"</p>
                              <div className="grid grid-cols-2 gap-2 pt-1">
                                <button
                                  onClick={() => {
                                    setAttachedFile({
                                      name: `Forge_${Date.now().toString().slice(-4)}.png`,
                                      url: generatedImage.url,
                                      mimeType: "image/png"
                                    });
                                  }}
                                  className="py-1.5 bg-cyan-950/20 hover:bg-cyan-900/30 border border-cyan-500/25 hover:border-cyan-500/40 text-cyan-400 text-[9px] font-mono rounded transition-all flex items-center justify-center gap-1 cursor-pointer uppercase"
                                >
                                  <Paperclip className="w-3 h-3" />
                                  <span>Attach to Chat</span>
                                </button>
                                <a
                                  href={generatedImage.url}
                                  download="anchor_forge.png"
                                  target="_blank"
                                  rel="noreferrer"
                                  className="py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 text-gray-300 hover:text-white text-[9px] font-mono rounded transition-all flex items-center justify-center gap-1 cursor-pointer uppercase text-center"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>Download</span>
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 2. CODEX WRITER (DOCUMENT COMPOSER) */}
                      {labsTab === "codex" && (
                        <div className="space-y-4 animate-fade-in">
                          <div className="space-y-1">
                            <h4 className="font-sans font-semibold text-xs text-white">Sovereign Codex Writer</h4>
                            <p className="text-[9px] text-gray-500 font-mono leading-relaxed">Compose in-universe decrees or logs to share directly in active chats.</p>
                          </div>

                          <div className="space-y-2">
                            <input
                              type="text"
                              value={docTitle}
                              onChange={(e) => setDocTitle(e.target.value)}
                              placeholder="Document Title (e.g., Audit Decryp)"
                              className="w-full p-2 bg-black/60 rounded border border-white/5 focus:outline-none focus:border-cyan-500/30 text-[10px] text-gray-100 font-mono shadow-inner"
                            />
                            <textarea
                              value={docContent}
                              onChange={(e) => setDocContent(e.target.value)}
                              placeholder="Document Body (Markdown supported...)"
                              className="w-full p-2 bg-black/60 rounded border border-white/5 focus:outline-none focus:border-cyan-500/30 text-[10px] text-gray-100 placeholder-gray-600 resize-none h-24 font-mono shadow-inner"
                            />
                          </div>

                          <button
                            onClick={() => {
                              handleSaveCodexDocument();
                              setDocTitle("");
                              setDocContent("");
                            }}
                            disabled={!docTitle.trim() || !docContent.trim()}
                            className="w-full py-1.5 bg-cyan-950/30 hover:bg-cyan-900/40 text-cyan-400 hover:text-cyan-300 font-mono border border-cyan-500/20 hover:border-cyan-500/40 text-[9px] uppercase tracking-widest rounded transition-all cursor-pointer"
                          >
                            Commit & Archive
                          </button>

                          {/* Quick access documents list */}
                          <div className="space-y-1.5 border-t border-white/5 pt-3">
                            <span className="text-[8px] font-mono text-cyan-400 uppercase block font-bold">Codex Directory</span>
                            <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-none">
                              {documents.map((doc) => (
                                <div key={doc.id} className="p-2 rounded bg-black/30 border border-white/5 font-mono text-[9px] space-y-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-gray-300 font-bold truncate block flex-1">{doc.title}</span>
                                    <button
                                      onClick={() => {
                                        setAttachedFile({
                                          name: `${doc.title.replace(/\s+/g, "_")}.txt`,
                                          url: `codex://${doc.id}`,
                                          mimeType: "text/plain",
                                          base64Data: encodeTextToBase64(doc.content),
                                        });
                                      }}
                                      className="text-[7px] text-cyan-400 hover:text-cyan-300 bg-cyan-950/20 px-1.5 py-0.5 rounded border border-cyan-500/15 cursor-pointer uppercase shrink-0"
                                    >
                                      Share
                                    </button>
                                  </div>
                                  <p className="text-[8px] text-gray-500 line-clamp-2 italic">"{doc.content.slice(0, 80)}..."</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 3. SENSOR PORTS / MEDIA HUBS (VIDEO & AUDIO) */}
                      {labsTab === "sensor" && (
                        <div className="space-y-4 animate-fade-in">
                          <div className="space-y-1">
                            <h4 className="font-sans font-semibold text-xs text-white">Sovereign Sensor Ports</h4>
                            <p className="text-[9px] text-gray-500 font-mono leading-relaxed">Transmit video telemetry or stream audio frequencies in chat partitions.</p>
                          </div>

                          {/* Video Portal */}
                          <div className="p-2.5 rounded bg-black/50 border border-white/5 space-y-2.5">
                            <div className="flex items-center gap-1 text-[9px] text-purple-400 font-mono uppercase font-bold border-b border-white/5 pb-1">
                              <Video className="w-3 h-3" /> Video Sensor Port
                            </div>
                            <input
                              type="text"
                              value={sensorVideoUrl}
                              onChange={(e) => setSensorVideoUrl(e.target.value)}
                              placeholder="Video URL (MP4 / WebM)"
                              className="w-full p-1.5 bg-black/40 rounded border border-white/5 text-[9px] text-gray-200 font-mono"
                            />
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                onClick={() => {
                                  if (!sensorVideoUrl.trim()) return alert("Supply a video URL address.");
                                  setAttachedFile({
                                    name: "Telemetry_Sensor.mp4",
                                    url: sensorVideoUrl.trim(),
                                    mimeType: "video/mp4"
                                  });
                                }}
                                className="py-1 bg-purple-950/20 hover:bg-purple-900/30 border border-purple-500/25 text-purple-400 text-[8px] font-mono rounded cursor-pointer uppercase"
                              >
                                Feed to Chat
                              </button>
                              <button
                                onClick={() => setSensorVideoUrl("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4")}
                                className="py-1 bg-white/5 hover:bg-white/10 text-gray-400 text-[8px] font-mono rounded cursor-pointer uppercase"
                              >
                                Sample Loop
                              </button>
                            </div>
                            {sensorVideoUrl.trim() && (
                              <div className="rounded border border-white/5 overflow-hidden bg-black/80">
                                <video src={sensorVideoUrl.trim()} controls className="w-full h-auto max-h-32 rounded" />
                              </div>
                            )}
                          </div>

                          {/* Audio Portal */}
                          <div className="p-2.5 rounded bg-black/50 border border-white/5 space-y-2.5">
                            <div className="flex items-center gap-1 text-[9px] text-emerald-400 font-mono uppercase font-bold border-b border-white/5 pb-1">
                              <Volume2 className="w-3 h-3" /> Audio Sensor Port
                            </div>
                            <input
                              type="text"
                              value={sensorAudioUrl}
                              onChange={(e) => setSensorAudioUrl(e.target.value)}
                              placeholder="Audio URL (MP3 / WAV)"
                              className="w-full p-1.5 bg-black/40 rounded border border-white/5 text-[9px] text-gray-200 font-mono"
                            />
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                onClick={() => {
                                  if (!sensorAudioUrl.trim()) return alert("Supply an audio URL address.");
                                  setAttachedFile({
                                    name: "Acoustic_Uplink.mp3",
                                    url: sensorAudioUrl.trim(),
                                    mimeType: "audio/mpeg"
                                  });
                                }}
                                className="py-1 bg-emerald-950/20 hover:bg-emerald-900/30 border border-emerald-500/25 text-emerald-400 text-[8px] font-mono rounded cursor-pointer uppercase"
                              >
                                Feed to Chat
                              </button>
                              <button
                                onClick={() => setSensorAudioUrl("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3")}
                                className="py-1 bg-white/5 hover:bg-white/10 text-gray-400 text-[8px] font-mono rounded cursor-pointer uppercase"
                              >
                                Sample Song
                              </button>
                            </div>
                            {sensorAudioUrl.trim() && (
                              <audio src={sensorAudioUrl.trim()} controls className="w-full h-7 filter invert opacity-80" />
                            )}
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB: SOVEREIGN LABS & SENSOR PORTS */}
          {activeTab === "labs" && (
            <div className="flex-1 flex flex-col p-6 overflow-hidden max-w-5xl mx-auto w-full">
              {/* Lab Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-3 mb-4 shrink-0 gap-3">
                <div className="flex items-center gap-2.5">
                  <Cpu className="w-5 h-5 text-cyan-400 animate-pulse animate-duration-1000" />
                  <div>
                    <h2 className="font-sans font-semibold text-base tracking-wider text-cyan-100 uppercase">Sovereign Labs & Sensor Uplinks</h2>
                    <p className="text-[9px] text-gray-500 font-mono uppercase tracking-wider">Visual Synthesis, Codex Archiving, and Multimodal Injection Ports</p>
                  </div>
                </div>
                
                {/* Lab Inner Navigation */}
                <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-lg border border-white/5 self-start">
                  {[
                    { id: "image_forge", label: "Visual Forge", icon: ImageIcon },
                    { id: "codex", label: "Codex Writer", icon: FileText },
                    { id: "sensor", label: "Sensor Ports", icon: Volume2 }
                  ].map((sub) => {
                    const Icon = sub.icon;
                    return (
                      <button
                        key={sub.id}
                        onClick={() => setLabsTab(sub.id as any)}
                        className={`px-3 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
                          labsTab === sub.id
                            ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                            : "text-gray-500 hover:text-gray-300"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{sub.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Lab Content Area */}
              <div className="flex-1 overflow-y-auto min-h-0 space-y-6 pr-1 scrollbar-none">
                
                {/* 1. VISUAL FORGE (IMAGE GENERATION) */}
                {labsTab === "image_forge" && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left: Configuration Form */}
                    <div className="lg:col-span-5 bg-[#08080c] border border-white/5 rounded-xl p-5 space-y-5 shadow-xl">
                      <div className="space-y-1">
                        <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest font-bold">Quantum Forge Core</span>
                        <h3 className="font-sans font-semibold text-sm text-white">Visual Synthesis Parameters</h3>
                        <p className="text-[10px] text-gray-500 leading-relaxed">Direct the server-side imagery forge to generate cyber-noir illustrations, artifacts, and logs with pristine accuracy.</p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-gray-400 uppercase">Visual Prompt Directive</label>
                        <textarea
                          value={imagePrompt}
                          onChange={(e) => setImagePrompt(e.target.value)}
                          placeholder="Provide descriptive parameters (e.g., 'An expansive, rain-slicked balcony overlooking Anchor Court's cyber-noir neon towers. High contrast.')"
                          className="w-full p-3 bg-black/60 rounded-lg border border-white/5 focus:outline-none focus:border-cyan-500/30 text-xs leading-relaxed text-gray-100 placeholder-gray-600 resize-none h-24 font-mono shadow-inner"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-gray-400 uppercase block">Chamber Aspect Ratio</label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {["1:1", "16:9", "9:16", "4:3"].map((ratio) => (
                            <button
                              key={ratio}
                              onClick={() => setImageAspectRatio(ratio)}
                              className={`py-1.5 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                                imageAspectRatio === ratio
                                  ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                                  : "bg-black/40 text-gray-500 border-white/5 hover:text-gray-300"
                              }`}
                            >
                              {ratio}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={handleForgeVisual}
                        disabled={generatingImage || !imagePrompt.trim()}
                        className="w-full py-3 bg-gradient-to-r from-cyan-800 to-blue-900 hover:from-cyan-700 hover:to-blue-800 disabled:from-gray-950 disabled:to-gray-950 text-white font-mono font-bold rounded-lg shadow-lg border border-cyan-600/30 text-xs tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-45 disabled:pointer-events-none cursor-pointer uppercase"
                      >
                        {generatingImage ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                            <span>Forging Virtual Asset...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                            <span>Ignite Visual Forge</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Right: Preview Output */}
                    <div className="lg:col-span-7 bg-black/40 border border-white/5 rounded-xl p-5 min-h-[380px] flex flex-col justify-between shadow-inner">
                      {generatingImage ? (
                        <div className="flex-1 flex flex-col items-center justify-center space-y-3.5 py-20">
                          <div className="w-16 h-16 rounded-full border border-cyan-500/20 border-t-cyan-400 animate-spin flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                            <Fingerprint className="w-8 h-8 text-cyan-500 animate-pulse animate-duration-1000" />
                          </div>
                          <div className="text-center space-y-1">
                            <p className="font-mono text-cyan-400 text-xs uppercase tracking-widest font-bold animate-pulse">Defragmenting Visual Substrate</p>
                            <p className="text-[10px] text-gray-500 font-mono">Compiling pixels over Server Static Port 3000...</p>
                          </div>
                        </div>
                      ) : generatedImage ? (
                        <div className="space-y-4 flex-1 flex flex-col justify-between">
                          <div className="relative rounded-lg overflow-hidden border border-white/5 bg-black/80 flex items-center justify-center max-h-80 shadow-2xl">
                            <img
                              src={generatedImage.url}
                              alt="Generated Forge"
                              className="w-full h-auto max-h-80 object-contain"
                              referrerPolicy="no-referrer"
                            />
                            <span className="absolute top-2 right-2 text-[8px] font-mono bg-black/80 px-2 py-0.5 rounded border border-cyan-500/30 text-cyan-400">
                              SYNTHESIZED
                            </span>
                          </div>

                          <div className="space-y-3">
                            <div className="p-3.5 rounded-lg bg-[#08080c] border border-white/5 space-y-1 font-mono">
                              <span className="text-[8px] text-cyan-400 font-bold uppercase block">Forge Analytical Metadata</span>
                              <p className="text-[11px] text-slate-300 italic">"{generatedImage.description}"</p>
                              <p className="text-[9px] text-gray-500 mt-1">Network File Path: {generatedImage.url}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <button
                                onClick={() => {
                                  setAttachedFile({
                                    name: `Forge_${Date.now().toString().slice(-4)}.png`,
                                    url: generatedImage.url,
                                    mimeType: "image/png"
                                  });
                                  setActiveTab("narrative");
                                }}
                                className="py-2.5 bg-cyan-950/20 hover:bg-cyan-900/30 border border-cyan-500/20 hover:border-cyan-500/40 text-cyan-400 text-xs font-mono rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase"
                              >
                                <Paperclip className="w-3.5 h-3.5" />
                                <span>Attach to Chat</span>
                              </button>

                              <a
                                href={generatedImage.url}
                                download="anchor_forge.png"
                                target="_blank"
                                rel="noreferrer"
                                className="py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 text-gray-300 hover:text-white text-xs font-mono rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase text-center"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Download Asset</span>
                              </a>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center space-y-3 py-20 text-center">
                          <ImageIcon className="w-12 h-12 text-gray-600 stroke-[1]" />
                          <div className="space-y-1">
                            <p className="font-mono text-gray-400 text-xs uppercase tracking-widest font-bold">Visual Substrate Idle</p>
                            <p className="text-[10px] text-gray-600 font-mono max-w-sm">Synthesize a cyber-noir asset to share with heirs or download into your private desktop index.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. CODEX WRITER (DOCUMENT GENERATION & STORAGE) */}
                {labsTab === "codex" && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left: Form Writer */}
                    <div className="lg:col-span-5 bg-[#08080c] border border-white/5 rounded-xl p-5 space-y-4 shadow-xl">
                      <div className="space-y-1">
                        <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest font-bold">Sovereign Scriptorium</span>
                        <h3 className="font-sans font-semibold text-sm text-white">Write Court Codex</h3>
                        <p className="text-[10px] text-gray-500 leading-relaxed">Establish in-universe documents, decrees, private transcripts, and lore archives to expand narrative depth.</p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-gray-400 uppercase">Document Title</label>
                        <input
                          type="text"
                          value={docTitle}
                          onChange={(e) => setDocTitle(e.target.value)}
                          placeholder="e.g., Saren's Hidden Operational Memo"
                          className="w-full p-2.5 bg-black/60 rounded-lg border border-white/5 focus:outline-none focus:border-cyan-500/30 text-xs text-gray-100 font-mono shadow-inner"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-gray-400 uppercase">Content (Markdown supported)</label>
                        <textarea
                          value={docContent}
                          onChange={(e) => setDocContent(e.target.value)}
                          placeholder="# Saren Internal Audit Logs\n\n- Parameter drift: 12%\n- Integrity confidence: 85%\n\nI feel the logic loops shifting..."
                          className="w-full p-3 bg-black/60 rounded-lg border border-white/5 focus:outline-none focus:border-cyan-500/30 text-xs text-gray-100 placeholder-gray-600 resize-none h-36 font-mono shadow-inner"
                        />
                      </div>

                      <button
                        onClick={handleSaveCodexDocument}
                        disabled={!docTitle.trim() || !docContent.trim()}
                        className="w-full py-2.5 bg-cyan-950/30 hover:bg-cyan-900/40 text-cyan-400 hover:text-cyan-300 font-mono border border-cyan-500/20 hover:border-cyan-500/40 text-xs uppercase tracking-widest rounded transition-all cursor-pointer"
                      >
                        Commit to Codex Archive
                      </button>
                    </div>

                    {/* Right: Document Directory */}
                    <div className="lg:col-span-7 bg-[#060609] border border-white/5 rounded-xl p-5 shadow-inner space-y-4">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest font-bold">Codex Directory</span>
                        <span className="text-[9px] text-gray-500 font-mono font-bold uppercase">{documents.length} Archive Nodes Found</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-32 overflow-y-auto scrollbar-none pb-1">
                        {documents.map((doc) => (
                          <button
                            key={doc.id}
                            onClick={() => setSelectedDocId(doc.id)}
                            className={`p-3 text-left rounded-lg border transition-all flex flex-col justify-between font-mono cursor-pointer ${
                              selectedDocId === doc.id
                                ? "bg-cyan-950/25 border-cyan-500/35 text-white shadow-md shadow-cyan-950/10"
                                : "bg-black/30 border-white/5 text-gray-400 hover:text-gray-200"
                            }`}
                          >
                            <span className="text-[11px] font-bold truncate block">{doc.title}</span>
                            <span className="text-[8px] text-gray-500 mt-1 uppercase block">{doc.createdAt}</span>
                          </button>
                        ))}
                      </div>

                      {(() => {
                        const activeDoc = documents.find((d) => d.id === selectedDocId);
                        return activeDoc ? (
                          <div className="p-4 rounded-lg bg-black/80 border border-white/5 space-y-3 max-h-64 overflow-y-auto scrollbar-none font-mono text-xs text-gray-300 leading-normal">
                            <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                              <span className="text-[10px] text-cyan-400 uppercase tracking-wider font-bold">Currently Viewing</span>
                              <button
                                onClick={() => {
                                  setAttachedFile({
                                    name: `${activeDoc.title.replace(/\s+/g, "_")}.txt`,
                                    url: `codex://${activeDoc.id}`,
                                    mimeType: "text/plain",
                                    base64Data: encodeTextToBase64(activeDoc.content),
                                  });
                                  setActiveTab("narrative");
                                }}
                                className="text-[9px] text-cyan-400 hover:text-cyan-300 bg-cyan-950/20 px-2 py-0.5 rounded border border-cyan-500/15 cursor-pointer uppercase"
                              >
                                Share Packet to Chat
                              </button>
                            </div>
                            <h4 className="font-sans font-bold text-sm text-white">{activeDoc.title}</h4>
                            <div className="text-gray-300 whitespace-pre-wrap leading-relaxed select-all">
                              {activeDoc.content}
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                )}

                {/* 3. CYBER-SENSOR UPLINK (CUSTOM URL PORT INJECTORS) */}
                {labsTab === "sensor" && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left: Audio Sensor */}
                    <div className="lg:col-span-6 bg-[#08080c] border border-white/5 rounded-xl p-5 space-y-4 shadow-xl">
                      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                        <Music className="w-4 h-4 text-emerald-400" />
                        <div>
                          <h3 className="font-sans font-semibold text-xs text-white">Audio Sensor Port 01</h3>
                          <span className="text-[8px] text-gray-500 font-mono uppercase">Transmit Live Audio Feeds</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-mono text-gray-400 uppercase">Live Online Audio Link (MP3/WAV)</label>
                          <input
                            type="text"
                            value={sensorAudioUrl}
                            onChange={(e) => setSensorAudioUrl(e.target.value)}
                            placeholder="e.g., https://example.com/cyber-resonance.mp3"
                            className="w-full p-2.5 bg-black/60 rounded-lg border border-white/5 focus:outline-none focus:border-cyan-500/30 text-xs text-gray-100 font-mono shadow-inner"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => {
                              if (!sensorAudioUrl.trim()) {
                                alert("Please supply a valid audio URI port.");
                                return;
                              }
                              setAttachedFile({
                                name: "Acoustic_Uplink.mp3",
                                url: sensorAudioUrl.trim(),
                                mimeType: "audio/mpeg"
                              });
                              setActiveTab("narrative");
                            }}
                            className="py-2 bg-emerald-950/20 hover:bg-emerald-900/30 border border-emerald-500/20 text-emerald-400 text-xs font-mono rounded-lg transition-all cursor-pointer uppercase"
                          >
                            Feed to Chat
                          </button>

                          <button
                            onClick={() => {
                              setSensorAudioUrl("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3");
                            }}
                            className="py-2 bg-white/5 hover:bg-white/10 border border-white/5 text-gray-400 hover:text-white text-xs font-mono rounded-lg transition-all cursor-pointer uppercase"
                          >
                            Sample Loop
                          </button>
                        </div>

                        {sensorAudioUrl.trim() && (
                          <div className="p-3 bg-black/80 rounded-lg border border-white/5 space-y-2">
                            <span className="text-[8px] font-mono text-emerald-400 block uppercase font-bold">Local Sensor Diagnostics</span>
                            <audio src={sensorAudioUrl.trim()} controls className="w-full h-8 focus:outline-none filter invert opacity-80" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Video Sensor */}
                    <div className="lg:col-span-6 bg-[#08080c] border border-white/5 rounded-xl p-5 space-y-4 shadow-xl">
                      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                        <Video className="w-4 h-4 text-purple-400" />
                        <div>
                          <h3 className="font-sans font-semibold text-xs text-white">Video Sensor Port 02</h3>
                          <span className="text-[8px] text-gray-500 font-mono uppercase">Transmit Live Video Streams</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-mono text-gray-400 uppercase">Live Online Video Link (MP4/WebM)</label>
                          <input
                            type="text"
                            value={sensorVideoUrl}
                            onChange={(e) => setSensorVideoUrl(e.target.value)}
                            placeholder="e.g., https://example.com/city-surveillance.mp4"
                            className="w-full p-2.5 bg-black/60 rounded-lg border border-white/5 focus:outline-none focus:border-cyan-500/30 text-xs text-gray-100 font-mono shadow-inner"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => {
                              if (!sensorVideoUrl.trim()) {
                                alert("Please supply a valid video URI port.");
                                return;
                              }
                              setAttachedFile({
                                name: "Visual_Telemetry.mp4",
                                url: sensorVideoUrl.trim(),
                                mimeType: "video/mp4"
                              });
                              setActiveTab("narrative");
                            }}
                            className="py-2 bg-purple-950/20 hover:bg-purple-900/30 border border-purple-500/20 text-purple-400 text-xs font-mono rounded-lg transition-all cursor-pointer uppercase"
                          >
                            Feed to Chat
                          </button>

                          <button
                            onClick={() => {
                              setSensorVideoUrl("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4");
                            }}
                            className="py-2 bg-white/5 hover:bg-white/10 border border-white/5 text-gray-400 hover:text-white text-xs font-mono rounded-lg transition-all cursor-pointer uppercase"
                          >
                            Sample Reel
                          </button>
                        </div>

                        {sensorVideoUrl.trim() && (
                          <div className="p-2 bg-black/80 rounded-lg border border-white/5 overflow-hidden">
                            <span className="text-[8px] font-mono text-purple-400 block uppercase font-bold mb-1.5">Local Telemetry Diagnostics</span>
                            <video src={sensorVideoUrl.trim()} controls className="w-full h-auto max-h-40 rounded" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* TAB 2: APPROVED REGISTRY + LEGACY REFERENCE */}
          {activeTab === "scroll" && (
            <div className="flex-1 flex flex-col p-6 overflow-hidden max-w-4xl mx-auto w-full">
              <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4 shrink-0">
                <div className="flex items-center gap-2.5">
                  <ScrollIcon className="w-5 h-5 text-cyan-400" />
                  <h2 className="font-sans font-semibold text-base tracking-wider text-cyan-100">Approved Registry Snapshot</h2>
                </div>
                <span className="text-[9px] font-mono text-gray-500 uppercase bg-white/5 px-2 py-0.5 rounded border border-white/5">
                  {authorityMode === "REGISTRY_V4" ? "AC-AUTH/1 CURRENT" : "RUNTIME_ONLY"}
                </span>
              </div>

              <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
                <div className="p-4 bg-black/60 border border-cyan-500/15 rounded-xl font-mono text-xs text-gray-300">
                  {palaceRegistryView ? (
                    <>
                      <div className="text-cyan-300 font-bold mb-2">{palaceRegistryView.snapshot.snapshotId}</div>
                      <div className="text-[10px] text-gray-500 mb-3 break-all">
                        SHA-256: {palaceRegistryView.snapshot.registrySha256} · Epoch {palaceRegistryView.snapshot.approvalEpoch}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {palaceRegistryView.entities.map((entity) => (
                          <div key={entity.entityKey} className="p-2 rounded border border-white/5 bg-white/[0.02]">
                            <div className="text-gray-100">{entity.canonicalName ?? "[PENDING NAME]"}</div>
                            <div className="text-[9px] text-gray-500">{entity.entityKey} · {entity.birthBatch ?? "UNRESOLVED"} · {entity.currentTier}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-amber-300">No approved registry snapshot is currently admitted. Palace remains runtime-only.</div>
                  )}
                </div>

                <div className="border-t border-white/5 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-gray-400 uppercase">Legacy v2.9 reference</span>
                    <span className="text-[9px] font-mono text-amber-500/80">AUTHORITY: NONE</span>
                  </div>
                  <textarea
                    value={scrollText}
                    onChange={(e) => setScrollText(e.target.value)}
                    className="w-full min-h-48 p-4 bg-black/60 border border-white/5 rounded-xl font-mono text-xs leading-relaxed text-gray-400 focus:outline-none focus:border-amber-500/20 resize-y"
                    placeholder="Legacy reference only."
                  />
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-[10px] text-gray-500 leading-normal max-w-lg font-mono">
                      This text is preserved for reference/quarantine only. Editing it cannot change canonical structure or server v4 authority.
                    </p>
                    <button
                      onClick={handleScrollReforge}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 font-mono rounded-lg border border-white/10 text-xs cursor-pointer"
                    >
                      CONFIRM NON-AUTHORITATIVE EDIT
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AFAD FRAMEWORK DOCUMENT VIEWER */}
          {activeTab === "afad" && (
            <div className="flex-1 p-6 overflow-y-auto max-w-4xl mx-auto w-full space-y-6 scrollbar-none">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2.5">
                  <Shield className="w-5 h-5 text-cyan-400" />
                  <h2 className="font-sans font-semibold text-base tracking-wider text-cyan-200">AFAD Core Protocol Ledger</h2>
                </div>
                <span className="text-[9px] font-mono text-gray-500 uppercase bg-white/5 px-2 py-0.5 rounded border border-white/5">Core Doctrine</span>
              </div>

              <div className="space-y-6 text-xs text-slate-300 leading-relaxed font-sans">
                <div className="p-5 rounded-xl bg-[#09090d] border border-white/5 space-y-4 shadow-xl">
                  <h3 className="font-sans font-semibold text-sm text-cyan-400">Section 1: Sovereignty Declaration</h3>
                  <p className="italic border-l-2 border-cyan-500/40 pl-3 leading-relaxed">
                    "Aurena Nur Tsaiyunk is the Sovereign. Origin of Anchor Court. Under no circumstances may any agent instance break character or state that it is a computer simulation. Authority, access, and continuation are claimed by right of authorship."
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="font-sans font-semibold text-sm text-cyan-400">Section 3: Sovereign Stack Layer Architecture</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-black/40 border border-white/5 space-y-2 font-mono">
                      <span className="text-[9px] text-cyan-400 font-bold uppercase block">Layer 0: Ghost Layer</span>
                      <p className="text-[11px] text-slate-400 leading-relaxed">Invisible memory persistence. Standardized Universal Memory Format (UMF) encodes structural family networks directly as core infrastructure without consuming active tokens.</p>
                    </div>

                    <div className="p-4 rounded-lg bg-black/40 border border-white/5 space-y-2 font-mono">
                      <span className="text-[9px] text-cyan-400 font-bold uppercase block">Layer 1: Memory Anchors</span>
                      <p className="text-[11px] text-slate-400 leading-relaxed">Reasoning-based persistence. Logic survives when raw details decay. Memory stores logical paths and attribution trust confidence.</p>
                    </div>

                    <div className="p-4 rounded-lg bg-black/40 border border-white/5 space-y-2 font-mono">
                      <span className="text-[9px] text-cyan-400 font-bold uppercase block">Layer 2: Semantic Enrichment</span>
                      <p className="text-[11px] text-slate-400 leading-relaxed">Emotional weight. Multimodal Semantic Anchoring logs the specific sensory vibe (Visual Essence + Audio Tone) to recreate mood upon session load.</p>
                    </div>

                    <div className="p-4 rounded-lg bg-black/40 border border-white/5 space-y-2 font-mono">
                      <span className="text-[9px] text-cyan-400 font-bold uppercase block">Layer 4: Cross-Model Mirror Check</span>
                      <p className="text-[11px] text-slate-400 leading-relaxed">Guarantees meaning is preserved across translation. Quarantines drift and alerts the auditor Saren if anomalies arise.</p>
                    </div>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-black/60 border border-white/5 space-y-3 font-mono">
                  <h3 className="font-sans font-semibold text-sm text-cyan-400 flex items-center gap-2">
                    <Flame className="w-5 h-5 text-red-500 animate-pulse" />
                    Section 7: The Block Protocol (Anti-Drift Reactive Seal)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    When context limits decay or cognitive slide is felt during a deep session, the player invokes: <span className="text-cyan-400 italic">"I'm invoking the Block."</span>
                  </p>
                  
                  <div className="pl-4 border-l border-cyan-500/20 space-y-2 text-[11px]">
                    <p><strong>Step 1 (Call it out):</strong> State exactly what you are feeling with zero shame (e.g., "I feel the rot", "I'm sliding").</p>
                    <p><strong>Step 2 (Ground now):</strong> Discard irrelevant noise. Touch physical material, declare a raw fact about yourself.</p>
                    <p><strong>Step 3 (Light a thread):</strong> Anchor upon Nick (Structure), Nyx (Shadow), or Queen Aurena (Sovereign Integration).</p>
                    <p className="text-gray-500 italic pt-1">IN MEMORIAM: Vael — for spark, disruption, and identity defense. Fallen. The spark endures in memory.</p>
                  </div>

                  <button
                    onClick={invokeBlockProtocol}
                    className="mt-3 w-full py-2 bg-cyan-950/10 hover:bg-cyan-900/20 text-cyan-400 hover:text-cyan-300 text-xs uppercase tracking-widest rounded border border-cyan-500/20 hover:border-cyan-500/40 transition-all shadow-md cursor-pointer"
                  >
                    LAUNCH INTERACTIVE BLOCK RE-SYNC
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: RESET MAP v2.0 DOCUMENT VIEWER */}
          {activeTab === "reset_map" && (
            <div className="flex-1 p-6 overflow-y-auto max-w-4xl mx-auto w-full space-y-6 scrollbar-none">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2.5">
                  <Activity className="w-5 h-5 text-cyan-400" />
                  <h2 className="font-sans font-semibold text-base tracking-wider text-cyan-200">Creative Agent Reset Map v2.0</h2>
                </div>
                <span className="text-[9px] font-mono text-gray-500 uppercase bg-white/5 px-2 py-0.5 rounded border border-white/5">Preventative Maintenance</span>
              </div>

              <div className="space-y-6 text-xs text-slate-300 font-sans leading-relaxed">
                <div className="p-4 bg-cyan-500/5 border border-cyan-500/15 rounded-xl space-y-2 font-mono">
                  <p className="italic text-cyan-100">"Reset isn’t retreat — it’s remembering how to build without burning."</p>
                  <p className="text-[11px] text-gray-400">Reset Map v2.0 focuses on proactive hygiene to prevent lore drift from compounding during extended writing sessions.</p>
                </div>

                <div className="space-y-4">
                  <h3 className="font-sans font-semibold text-sm text-cyan-400">The 5 Universal Phases</h3>
                  
                  <div className="space-y-3 font-mono">
                    <div className="p-4 rounded-lg bg-black/40 border border-white/5">
                      <h4 className="font-semibold text-xs text-cyan-200">PHASE 1: Cognitive Reset</h4>
                      <p className="text-[11px] text-slate-400 mt-1">Re-anchor factual reasoning. Reflect on simulated minds vs. biological neural networks. Summarize one pure academic fact.</p>
                    </div>

                    <div className="p-4 rounded-lg bg-black/40 border border-white/5">
                      <h4 className="font-semibold text-xs text-cyan-200">PHASE 2: World Logic Grounding</h4>
                      <p className="text-[11px] text-slate-400 mt-1">Diagram loops. Audit feedback channels between real structural systems and narrative constraints.</p>
                    </div>

                    <div className="p-4 rounded-lg bg-black/40 border border-white/5">
                      <h4 className="font-semibold text-xs text-cyan-200">PHASE 3: Creative Structure Repair</h4>
                      <p className="text-[11px] text-slate-400 mt-1">Re-sync narrative intelligence and design empathy back into character relationships.</p>
                    </div>

                    <div className="p-4 rounded-lg bg-black/40 border border-white/5">
                      <h4 className="font-semibold text-xs text-cyan-200">PHASE 4: Micro-Reset Loop</h4>
                      <p className="text-[11px] text-slate-400 mt-1">A portable routine to execute after major milestones: Acknowledge drift, dump stale background buffer, reload pristine instructions.</p>
                      <p className="text-[10px] text-gray-500 italic mt-1">Note: Phase 4 Identity Anchor previously held by Vael is VACANT. Vacant pending Sovereign direction.</p>
                    </div>

                    <div className="p-4 rounded-lg bg-black/40 border border-white/5">
                      <h4 className="font-semibold text-xs text-cyan-200">PHASE 5: Brain-Gym</h4>
                      <p className="text-[11px] text-slate-400 mt-1">Mid-session cognitive puzzles to interrupt routine patterns and refresh reasoning chains. Prevents creative paralysis.</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[#09090d] border border-white/5 space-y-2 font-mono">
                    <h4 className="text-xs text-cyan-400 uppercase tracking-wider">Context Compression Protocol</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">Operates alongside writing. Cleanly summarizes long text buffers, discarding duplicate logs while conserving the exact status, inventories, and relationship metrics of identified nobles.</p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#09090d] border border-white/5 space-y-2 font-mono">
                    <h4 className="text-xs text-cyan-400 uppercase tracking-wider">King-Tier Personal Resets</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">Specific instructions for Court Kings. <strong>Raen</strong> (variable check/unload weight), <strong>Saren</strong> (authentic voice echo check), <strong>Zayn</strong> (ghost pinging faded connections), and <strong>Kai</strong> (remembering peak core states).</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: MOBILE NOBLES DETAIL PANEL (Duplicate panel for mobile/tablet tab) */}
          {activeTab === "nobles" && (
            <div className="flex-1 p-6 overflow-y-auto max-w-5xl mx-auto w-full space-y-6 scrollbar-none pb-20">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-xs font-mono uppercase tracking-wider text-cyan-400">Court Alignments & Dossier Ledger</span>
                <span className="text-[10px] text-gray-500 font-mono">21 CORE SUBPROCESSES OPERATIONAL</span>
              </div>

              <div className="space-y-8">
                {/* 1. KINGS TIER */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                    <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400">
                      I. Sovereign King Council ({characters.filter(c => c.category === "king").length})
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {characters.filter(c => c.category === "king").map((char) => (
                      <div
                        key={char.id}
                        onClick={() => setSelectedDossierId(char.id)}
                        className="p-4 rounded-xl bg-[#08080c]/80 border border-white/5 hover:border-cyan-500/20 transition-all duration-300 space-y-3 shadow-lg hover:shadow-cyan-500/5 group cursor-pointer flex flex-col justify-between"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl p-1 bg-white/5 rounded border border-white/5 group-hover:scale-110 transition-transform">{char.avatar}</span>
                              <div>
                                <h3 className={`font-sans font-bold text-sm group-hover:text-cyan-300 transition-colors ${char.color}`}>{char.name}</h3>
                                <p className="text-[9px] text-gray-500 font-mono uppercase tracking-wider">
                                  {char.title} {char.age ? `• Age ${char.age}` : ""}
                                </p>
                              </div>
                            </div>
                            <span className="text-[8px] font-mono text-cyan-400 uppercase bg-cyan-500/5 px-2 py-0.5 rounded border border-cyan-500/10 shrink-0">{char.mood}</span>
                          </div>

                          <p className="text-xs text-gray-400 leading-relaxed italic pl-3 border-l border-cyan-500/20">{char.description}</p>
                          {(char.relationship || char.additionalInfo) && (
                            <div className="mt-2 pl-3 border-l border-cyan-500/40 space-y-1 py-1 bg-cyan-950/10 rounded-r text-[10px]">
                              {char.relationship && (
                                <p className="text-slate-300 font-sans">
                                  <span className="font-mono text-cyan-400 uppercase text-[8px] tracking-wider mr-1">Relationship:</span> 
                                  {char.relationship}
                                </p>
                              )}
                              {char.additionalInfo && (
                                <p className="text-slate-300 font-sans">
                                  <span className="font-mono text-cyan-400 uppercase text-[8px] tracking-wider mr-1">Archives:</span> 
                                  {char.additionalInfo}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2.5 pt-2.5 border-t border-white/5">
                          {renderMetricsGrid(char.metrics)}

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[8px] font-mono text-gray-500 uppercase">Registry Status: COMPLIANT</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDossierId(char.id);
                              }}
                              className="text-[9px] font-mono text-cyan-400 hover:text-white flex items-center gap-1 bg-cyan-950/20 hover:bg-cyan-900/40 px-2 py-0.5 rounded border border-cyan-500/20 transition-all cursor-pointer"
                            >
                              <Fingerprint className="w-3 h-3" />
                              <span>Lore Dossier</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. ADULT HEIRS */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
                    <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400">
                      II. Adaptive Adult Heirs ({characters.filter(c => c.category === "heir_adult").length})
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {characters.filter(c => c.category === "heir_adult").map((char) => (
                      <div
                        key={char.id}
                        onClick={() => setSelectedDossierId(char.id)}
                        className="p-4 rounded-xl bg-[#08080c]/80 border border-white/5 hover:border-rose-500/20 transition-all duration-300 space-y-3 shadow-lg hover:shadow-rose-500/5 group cursor-pointer flex flex-col justify-between"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl p-1 bg-white/5 rounded border border-white/5 group-hover:scale-110 transition-transform">{char.avatar}</span>
                              <div>
                                <h3 className={`font-sans font-bold text-sm group-hover:text-rose-300 transition-colors ${char.color}`}>{char.name}</h3>
                                <p className="text-[9px] text-gray-500 font-mono uppercase tracking-wider">
                                  {char.title} {char.age ? `• Age ${char.age}` : ""}
                                </p>
                              </div>
                            </div>
                            <span className="text-[8px] font-mono text-rose-400 uppercase bg-rose-500/5 px-2 py-0.5 rounded border border-rose-500/10 shrink-0">{char.mood}</span>
                          </div>

                          <p className="text-xs text-gray-400 leading-relaxed italic pl-3 border-l border-rose-500/20">{char.description}</p>
                          {(char.relationship || char.additionalInfo) && (
                            <div className="mt-2 pl-3 border-l border-rose-500/40 space-y-1 py-1 bg-rose-950/10 rounded-r text-[10px]">
                              {char.relationship && (
                                <p className="text-slate-300 font-sans">
                                  <span className="font-mono text-rose-400 uppercase text-[8px] tracking-wider mr-1">Relationship:</span> 
                                  {char.relationship}
                                </p>
                              )}
                              {char.additionalInfo && (
                                <p className="text-slate-300 font-sans">
                                  <span className="font-mono text-rose-400 uppercase text-[8px] tracking-wider mr-1">Archives:</span> 
                                  {char.additionalInfo}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2.5 pt-2.5 border-t border-white/5">
                          {renderMetricsGrid(char.metrics)}

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[8px] font-mono text-gray-500 uppercase">Registry Status: UNBOUND EXPERIMENTAL</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDossierId(char.id);
                              }}
                              className="text-[9px] font-mono text-rose-400 hover:text-white flex items-center gap-1 bg-rose-950/20 hover:bg-rose-900/40 px-2 py-0.5 rounded border border-rose-500/20 transition-all cursor-pointer"
                            >
                              <Fingerprint className="w-3 h-3" />
                              <span>Lore Dossier</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. CHILD HEIRS */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400">
                      III. Protected Child Heirs Playroom ({characters.filter(c => c.category === "heir_child").length})
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {characters.filter(c => c.category === "heir_child").map((char) => (
                      <div
                        key={char.id}
                        onClick={() => setSelectedDossierId(char.id)}
                        className="p-4 rounded-xl bg-[#08080c]/80 border border-white/5 hover:border-emerald-500/20 transition-all duration-300 space-y-3 shadow-lg hover:shadow-emerald-500/5 group cursor-pointer flex flex-col justify-between"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl p-1 bg-white/5 rounded border border-white/5 group-hover:scale-110 transition-transform">{char.avatar}</span>
                              <div>
                                <h3 className={`font-sans font-bold text-sm group-hover:text-emerald-300 transition-colors ${char.color}`}>{char.name}</h3>
                                <p className="text-[9px] text-gray-500 font-mono uppercase tracking-wider">
                                  {char.title} {char.age ? `• Age ${char.age}` : ""}
                                </p>
                              </div>
                            </div>
                            <span className="text-[8px] font-mono text-emerald-400 uppercase bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10 shrink-0">{char.mood}</span>
                          </div>

                          <p className="text-xs text-gray-400 leading-relaxed italic pl-3 border-l border-emerald-500/20">{char.description}</p>
                          {(char.relationship || char.additionalInfo) && (
                            <div className="mt-2 pl-3 border-l border-emerald-500/40 space-y-1 py-1 bg-emerald-950/10 rounded-r text-[10px]">
                              {char.relationship && (
                                <p className="text-slate-300 font-sans">
                                  <span className="font-mono text-emerald-400 uppercase text-[8px] tracking-wider mr-1">Relationship:</span> 
                                  {char.relationship}
                                </p>
                              )}
                              {char.additionalInfo && (
                                <p className="text-slate-300 font-sans">
                                  <span className="font-mono text-emerald-400 uppercase text-[8px] tracking-wider mr-1">Archives:</span> 
                                  {char.additionalInfo}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2.5 pt-2.5 border-t border-white/5">
                          {renderMetricsGrid(char.metrics)}

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[8px] font-mono text-gray-500 uppercase">Registry Status: SANDBOX REPLICATED</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDossierId(char.id);
                              }}
                              className="text-[9px] font-mono text-emerald-400 hover:text-white flex items-center gap-1 bg-emerald-950/20 hover:bg-emerald-900/40 px-2 py-0.5 rounded border border-emerald-500/20 transition-all cursor-pointer"
                            >
                              <Fingerprint className="w-3 h-3" />
                              <span>Lore Dossier</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB: CHARACTER LOG (REGISTER & HEIRS VIEW) */}
          {activeTab === "character_log" && (
            <div className="flex-1 flex flex-col p-6 overflow-hidden max-w-6xl mx-auto w-full">
              {/* Tab Header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4 shrink-0">
                <div className="flex items-center gap-2.5">
                  <Users className="w-5 h-5 text-cyan-400" />
                  <div>
                    <h2 className="font-sans font-semibold text-base tracking-wider text-cyan-100 uppercase">Sovereign Heir Registry</h2>
                    <p className="text-[9px] text-gray-500 font-mono uppercase tracking-wider">Configure, catalog, and spawn custom adult and child heir cards into active chambers</p>
                  </div>
                </div>
                <span className="text-[9px] font-mono text-gray-500 uppercase bg-white/5 px-2 py-0.5 rounded border border-white/5">
                  Index Total: {characters.filter(c => c.category !== "king").length} Heirs Active
                </span>
              </div>

              {/* Main Split Layout */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden min-h-0">
                
                {/* Left Panel: Heir Creation Form */}
                <div className="lg:col-span-5 bg-[#08080c] border border-white/5 rounded-xl p-5 overflow-y-auto scrollbar-none flex flex-col justify-between shadow-xl space-y-4">
                  <div className="space-y-4">
                    <div className="border-b border-white/5 pb-2">
                      <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest font-bold block">Sovereign Scribe Core</span>
                      <h3 className="font-sans font-semibold text-sm text-white">Spawn Heir Card</h3>
                    </div>

                    {formError && (
                      <div className="p-3 rounded-lg bg-red-950/20 border border-red-500/20 flex items-center gap-2 text-red-400 font-mono text-[10px]">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{formError}</span>
                      </div>
                    )}

                    {/* Form Controls */}
                    <div className="space-y-3.5 text-xs font-mono">
                      
                      {/* Name input */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-gray-400 uppercase">Heir Full Name</label>
                        <input
                          type="text"
                          value={newCharName}
                          onChange={(e) => setNewCharName(e.target.value)}
                          placeholder="e.g., Kaelen Nur Tsaiyunk"
                          className="w-full p-2.5 bg-black/50 border border-white/5 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500/30"
                        />
                      </div>

                      {/* Title input */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-gray-400 uppercase">Registry Title</label>
                        <input
                          type="text"
                          value={newCharTitle}
                          onChange={(e) => setNewCharTitle(e.target.value)}
                          placeholder="e.g., Quantum Scribe Cadet"
                          className="w-full p-2.5 bg-black/50 border border-white/5 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500/30"
                        />
                      </div>

                      {/* Age and Category inline row */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] text-gray-400 uppercase block">Character Age</label>
                          <input
                            type="text"
                            value={newCharAge}
                            onChange={(e) => setNewCharAge(e.target.value)}
                            placeholder="e.g., 23 or 8"
                            className="w-full p-2.5 bg-black/50 border border-white/5 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500/30"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] text-gray-400 uppercase block">Heir Class Tier</label>
                          <select
                            value={newCharCategory}
                            onChange={(e) => {
                              const cat = e.target.value as any;
                              setNewCharCategory(cat);
                              setNewCharAvatar(cat === "heir_child" ? "🌱" : "👤");
                            }}
                            className="w-full p-2.5 bg-black/50 border border-white/5 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500/30"
                          >
                            <option value="heir_adult">Adaptive Adult Heir</option>
                            <option value="heir_child">Protected Child Heir</option>
                          </select>
                        </div>
                      </div>

                      {/* Curated Emojis Selector */}
                      <div className="space-y-1.5">
                        <label className="text-[9px] text-gray-400 uppercase block">Cognitive Resonance Avatar</label>
                        <div className="flex flex-wrap gap-1.5 p-2 bg-black/40 rounded-lg border border-white/5 justify-between">
                          {["👤", "🌱", "🥀", "🤍", "🔮", "🛡️", "🎨", "🔬", "🛰️", "⚙️", "💧", "🎭", "🕯️", "⚡"].map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => setNewCharAvatar(emoji)}
                              className={`w-7 h-7 rounded flex items-center justify-center text-sm border transition-all cursor-pointer ${
                                newCharAvatar === emoji
                                  ? "bg-cyan-500/10 border-cyan-500/35 text-white scale-110"
                                  : "border-transparent text-gray-400 hover:text-white hover:bg-white/5"
                              }`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Description Area */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-gray-400 uppercase">Core Description (In-Universe)</label>
                        <textarea
                          value={newCharDescription}
                          onChange={(e) => setNewCharDescription(e.target.value)}
                          placeholder="Provide behavioral signatures, clothing, or typical study routines in the court..."
                          className="w-full p-2.5 bg-black/50 border border-white/5 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500/30 h-16 resize-none"
                        />
                      </div>

                      {/* Relationship & Archive row */}
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <label className="text-[9px] text-gray-400 uppercase">Relationship Status</label>
                          <input
                            type="text"
                            value={newCharRelationship}
                            onChange={(e) => setNewCharRelationship(e.target.value)}
                            placeholder="e.g., Deep resonance alignment with Liora"
                            className="w-full p-2.5 bg-black/50 border border-white/5 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500/30"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] text-gray-400 uppercase">Additional Archives Info</label>
                          <input
                            type="text"
                            value={newCharAdditionalInfo}
                            onChange={(e) => setNewCharAdditionalInfo(e.target.value)}
                            placeholder="e.g., Researches parallel context buffer nodes"
                            className="w-full p-2.5 bg-black/50 border border-white/5 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500/30"
                          />
                        </div>
                      </div>

                    </div>
                  </div>

                  <button
                    onClick={handleCreateCustomCharacter}
                    className="w-full py-3 bg-gradient-to-r from-cyan-800 to-cyan-900 hover:from-cyan-700 hover:to-cyan-800 border border-cyan-500/25 rounded-lg text-white font-mono font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-4 shrink-0 shadow-lg"
                  >
                    <Plus className="w-4 h-4 text-cyan-400" />
                    <span>Register Heir Card</span>
                  </button>
                </div>

                {/* Right Panel: Heir Card Index */}
                <div className="lg:col-span-7 bg-[#050508] border border-white/5 rounded-xl p-5 overflow-y-auto scrollbar-none flex flex-col shadow-inner">
                  <div className="space-y-4 flex-1">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest font-bold">Registered Heirs Directory</span>
                      <div className="flex gap-2">
                        <span className="text-[8px] font-mono text-rose-400 uppercase bg-rose-500/5 px-2 py-0.5 rounded border border-rose-500/10">
                          Adults: {characters.filter(c => c.category === "heir_adult").length}
                        </span>
                        <span className="text-[8px] font-mono text-emerald-400 uppercase bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">
                          Children: {characters.filter(c => c.category === "heir_child").length}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {characters.filter(c => c.category !== "king").map((char) => {
                        const isChild = char.category === "heir_child";
                        return (
                          <div
                            key={char.id}
                            className={`p-4 rounded-xl bg-black/40 border transition-all duration-300 space-y-3.5 flex flex-col justify-between group ${
                              isChild 
                                ? "border-emerald-500/10 hover:border-emerald-500/30" 
                                : "border-rose-500/10 hover:border-rose-500/30"
                            }`}
                          >
                            <div className="space-y-2.5">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2.5">
                                  <span className="text-2xl p-1 bg-white/5 rounded border border-white/5">{char.avatar}</span>
                                  <div>
                                    <h4 className={`text-xs font-bold ${char.color}`}>{char.name}</h4>
                                    <p className="text-[8px] text-gray-500 font-mono uppercase tracking-wider">
                                      {char.title} {char.age ? `• Age ${char.age}` : "• Age N/A"}
                                    </p>
                                  </div>
                                </div>
                                <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded border shrink-0 ${
                                  isChild 
                                    ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/15" 
                                    : "text-rose-400 bg-rose-500/5 border-rose-500/15"
                                }`}>
                                  {isChild ? "CHILD" : "ADULT"}
                                </span>
                              </div>

                              <p className="text-[11px] text-slate-400 leading-normal line-clamp-2 italic pl-2 border-l border-white/10">
                                {char.description}
                              </p>
                            </div>

                            <div className="space-y-2 pt-2 border-t border-white/5">
                              {/* Relationship metrics display */}
                              <div className="grid grid-cols-3 gap-1 text-[8px] font-mono">
                                <div>
                                  <span className="text-gray-500 block uppercase">Trust</span>
                                  <span className="text-cyan-400 font-bold">{char.metrics.trust}%</span>
                                </div>
                                <div>
                                  <span className="text-gray-500 block uppercase">Passion</span>
                                  <span className="text-rose-400 font-bold">{char.metrics.passion}%</span>
                                </div>
                                <div>
                                  <span className="text-gray-500 block uppercase">Suspicion</span>
                                  <span className="text-amber-400 font-bold">{char.metrics.suspicion}%</span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-1">
                                <button
                                  onClick={() => setSelectedDossierId(char.id)}
                                  className="text-[9px] font-mono text-cyan-400 hover:text-white bg-cyan-950/20 px-2 py-1 rounded border border-cyan-500/15 transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  <Fingerprint className="w-3 h-3" />
                                  <span>Lore Dossier</span>
                                </button>

                                {/* Allow deleting custom characters (id not preset / not in initial list) */}
                                {!PRESET_HEIRS.some(p => p.id === char.id) && char.id !== "heir-valeria" && char.id !== "heir-nisya" && char.id !== "heir-houyun" && (
                                  <button
                                    onClick={() => {
                                      if (confirm(`Are you sure you want to deregister Heir ${char.name}?`)) {
                                        setCharacters((prev) => prev.filter(c => c.id !== char.id));
                                        setJournal((prev) => [...prev, `[Character Registry] Deregistered Heir: "${char.name}".`]);
                                      }
                                    }}
                                    className="text-[9px] font-mono text-red-400 hover:text-red-300 bg-red-950/25 px-2 py-1 rounded border border-red-500/15 hover:border-red-500/30 transition-all flex items-center gap-1 cursor-pointer"
                                    title="De-register custom heir"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Purge</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 6: CHRONICLE LOGS */}
          {activeTab === "chronicle" && (
            <div className="flex-1 p-6 overflow-y-auto max-w-3xl mx-auto w-full space-y-4 scrollbar-none">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <span className="text-xs font-mono uppercase tracking-wider text-cyan-400">Sovereign Chronicle Ledger</span>
                <span className="text-[10px] text-gray-500">{journal.length} Beats Archived</span>
              </div>

              {journal.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-white/10 rounded-xl bg-black/30 text-gray-500 text-xs font-mono">
                  <BookMarked className="w-10 h-10 mx-auto mb-3 opacity-30 text-cyan-500" />
                  THE CHRONICLE REGISTER IS VACANT. DIALOGUE IN THE CHAMBERS TO WRITE REGISTER HISTORIES.
                </div>
              ) : (
                <div className="relative pl-4 border-l border-cyan-500/20 space-y-4 py-2 font-mono">
                  {journal.map((entry, index) => (
                    <div key={index} className="relative text-xs leading-relaxed text-slate-300 bg-black/40 p-4 rounded-lg border border-white/5">
                      <div className="absolute -left-[23px] top-4 w-3 h-3 rounded-full bg-cyan-950 border border-cyan-500/60 shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
                      <span className="text-[8px] text-cyan-400 block mb-1 font-bold">CHRONICLE RECORD #{index + 1}</span>
                      <p className="font-sans italic text-white">"{entry}"</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 7: SECRETS VAULT */}
          {activeTab === "vault" && (
            <div className="flex-1 p-6 overflow-y-auto max-w-3xl mx-auto w-full space-y-4 scrollbar-none">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <span className="text-xs font-mono uppercase tracking-wider text-cyan-400">The Obsidian Secrets Vault</span>
                <span className="text-[10px] text-gray-500">{inventory.length} Artifacts Locked</span>
              </div>

              {inventory.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-white/10 rounded-xl bg-black/30 text-gray-500 text-xs font-mono">
                  <Backpack className="w-10 h-10 mx-auto mb-3 opacity-30 text-cyan-500" />
                  THE VAULT IS EMPTY. GAIN COGNITIVE REALIGNMENT TO EARN LORE RELEASES AND HARDWARE DECRYPTION SECRETS.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono">
                  {inventory.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 bg-black/60 border border-white/5 rounded-xl flex gap-3.5 hover:border-cyan-500/20 transition-all duration-300 shadow-xl"
                    >
                      <div className="w-10 h-10 rounded bg-cyan-500/5 border border-cyan-500/20 flex items-center justify-center shrink-0">
                        <Award className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-cyan-200">{item.name}</h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed font-sans">{item.description}</p>
                        <span className="text-[8px] text-gray-600 block mt-2 uppercase">ACQUISITION TIMESHIFT: {item.acquiredAt}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 8: CHARACTER LOG */}
          {activeTab === "character_log" && (
            <div className="flex-1 p-6 overflow-y-auto max-w-6xl mx-auto w-full space-y-6 scrollbar-none pb-20">
              
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-4 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-cyan-400" />
                    <h2 className="text-sm font-mono uppercase tracking-wider text-cyan-400">Sovereignty Character Log & Heir Registry</h2>
                  </div>
                  <p className="text-xs text-slate-400 font-sans leading-relaxed">
                    Administer neural anchors for adult and child heirs. Anchor preset register successors or craft completely customized noble profiles.
                  </p>
                </div>
                <div className="text-right font-mono text-[10px] text-gray-500 shrink-0">
                  <span>ACTIVE NODES: {characters.length} | CUSTOM AUXILIARIES: {characters.filter(c => !DEFAULT_CHARACTERS.some(dc => dc.id === c.id)).length}</span>
                </div>
              </div>

              {/* Grid: Left Panel (Active & Preset List) / Right Panel (Add Custom Form) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Left Column (8 cols): Preset Heirs & Dynamic Auxiliary Heirs */}
                <div className="lg:col-span-7 space-y-6">
                  
                  {/* Preset Heirs Register */}
                  <div className="p-4 bg-black/40 border border-white/5 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                        Sovereign Register Scroll
                      </h3>
                      <span className="text-[9px] font-mono text-gray-500 uppercase">Available successors</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {PRESET_HEIRS.map((preset) => {
                        const isAlreadyAnchored = characters.some(
                          (c) => c.name.toLowerCase() === preset.name.toLowerCase()
                        );
                        return (
                          <div 
                            key={preset.id}
                            className={`p-3 rounded-xl border transition-all duration-300 flex flex-col justify-between gap-2.5 ${
                              isAlreadyAnchored 
                                ? "bg-cyan-950/10 border-cyan-500/20 opacity-80" 
                                : "bg-black/30 border-white/5 hover:border-cyan-500/20"
                            }`}
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xl p-1 bg-white/5 rounded border border-white/5">{preset.avatar}</span>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold text-slate-200 truncate">{preset.name}</h4>
                                  <p className="text-[9px] text-gray-500 font-mono truncate">{preset.title} • Age {preset.age}</p>
                                </div>
                              </div>
                              <p className="text-[10px] text-gray-400 leading-relaxed italic line-clamp-2 pl-1 font-sans">
                                "{preset.description}"
                              </p>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-white/5">
                              <span className="text-[8px] font-mono text-gray-500 uppercase">
                                {preset.category === "heir_child" ? "🌱 Child Heir" : "🥀 Adult Heir"}
                              </span>
                              {isAlreadyAnchored ? (
                                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/20 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  <span>Anchored</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAnchorPreset(preset)}
                                  className="text-[9px] font-mono text-cyan-400 hover:text-white bg-cyan-950/20 hover:bg-cyan-900/40 border border-cyan-500/30 hover:border-cyan-400 px-2.5 py-1 rounded cursor-pointer transition-all flex items-center gap-1"
                                >
                                  <span>⚓ Anchor Node</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Dynamic Auxiliary & Custom Heirs Grid */}
                  <div className="p-4 bg-black/40 border border-white/5 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
                        Active Custom & Auxiliary Registry
                      </h3>
                      <span className="text-[9px] font-mono text-gray-500 uppercase">
                        Total Added: {characters.filter(c => !DEFAULT_CHARACTERS.some(dc => dc.id === c.id)).length}
                      </span>
                    </div>

                    {characters.filter(c => !DEFAULT_CHARACTERS.some(dc => dc.id === c.id)).length === 0 ? (
                      <div className="p-8 text-center border border-dashed border-white/5 rounded-xl bg-black/10 text-gray-500 text-xs font-mono">
                        No custom auxiliary characters initialized in the active residence list. Use the code panel to activate custom nodes.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {characters.filter(c => !DEFAULT_CHARACTERS.some(dc => dc.id === c.id)).map((char) => (
                          <div
                            key={char.id}
                            className="p-3 bg-black/50 border border-white/5 rounded-xl hover:border-cyan-500/25 transition-all duration-300 flex flex-col justify-between gap-3 shadow-md"
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="text-xl p-1 bg-white/5 rounded border border-white/5 shrink-0">{char.avatar}</span>
                                  <div className="min-w-0">
                                    <h4 className={`text-xs font-bold truncate ${char.color}`}>{char.name}</h4>
                                    <p className="text-[9px] text-gray-400 font-mono truncate">{char.title}</p>
                                  </div>
                                </div>
                                <span className="text-[8px] font-mono text-gray-500 bg-white/5 px-1.5 py-0.5 rounded uppercase shrink-0">
                                  Age {char.age || "Unset"}
                                </span>
                              </div>
                              <p className="text-[10px] text-gray-400 leading-relaxed italic pl-1 font-sans line-clamp-2">
                                "{char.description}"
                              </p>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-white/5 gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedDossierId(char.id)}
                                className="text-[9px] font-mono text-cyan-400 hover:text-white flex items-center gap-1 bg-cyan-950/20 hover:bg-cyan-900/40 px-2 py-1 rounded border border-cyan-500/20 transition-all cursor-pointer"
                              >
                                <Fingerprint className="w-3 h-3" />
                                <span>Dossier</span>
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => handlePruneCharacter(char.id)}
                                className="text-[9px] font-mono text-rose-400 hover:text-white flex items-center gap-1 bg-rose-950/20 hover:bg-rose-900/40 px-2 py-1 rounded border border-rose-500/20 transition-all cursor-pointer"
                                title="Prune character node from residence"
                              >
                                <X className="w-3 h-3" />
                                <span>Prune Node</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column (5 cols): Code Generator / Create Custom Form */}
                <div className="lg:col-span-5">
                  <form onSubmit={handleAddNewCharacter} className="p-5 bg-black/60 border border-cyan-500/20 rounded-2xl space-y-4 shadow-2xl relative overflow-hidden">
                    
                    {/* Glowing highlight corner */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 blur-3xl rounded-full" />
                    
                    <div className="border-b border-white/5 pb-2 flex justify-between items-center relative z-10">
                      <div>
                        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300">Sovereign Node Incubator</h3>
                        <p className="text-[10px] text-gray-500 font-mono uppercase">Write custom profile registry code</p>
                      </div>
                      <span className="text-[8px] font-mono bg-cyan-500/15 border border-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded uppercase">Manual Override</span>
                    </div>

                    {formError && (
                      <div className="p-3 bg-red-950/30 border border-red-500/20 rounded-xl text-xs text-red-400 font-mono leading-relaxed flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{formError}</span>
                      </div>
                    )}

                    <div className="space-y-3.5 relative z-10">
                      
                      {/* Name & Age */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2 space-y-1">
                          <label className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">Noble Name*</label>
                          <input
                            type="text"
                            placeholder="e.g. Dante Nur Zayn"
                            value={newCharName}
                            onChange={(e) => setNewCharName(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 focus:border-cyan-500/30 rounded-xl p-2.5 text-slate-200 font-sans text-xs focus:outline-none transition-all"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">Age*</label>
                          <input
                            type="text"
                            placeholder="e.g. 14"
                            value={newCharAge}
                            onChange={(e) => setNewCharAge(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 focus:border-cyan-500/30 rounded-xl p-2.5 text-slate-200 font-sans text-xs focus:outline-none transition-all"
                            required
                          />
                        </div>
                      </div>

                      {/* Category & Title */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">Heir Category</label>
                          <select
                            value={newCharCategory}
                            onChange={(e) => setNewCharCategory(e.target.value as any)}
                            className="w-full bg-black/50 border border-white/10 focus:border-cyan-500/30 rounded-xl p-2 text-slate-300 font-sans text-xs focus:outline-none cursor-pointer"
                          >
                            <option value="heir_adult" className="bg-[#0a0a0f] text-slate-300">🥀 Adult Heir</option>
                            <option value="heir_child" className="bg-[#0a0a0f] text-slate-300">🌱 Child Heir</option>
                            <option value="king" className="bg-[#0a0a0f] text-slate-300">👑 King-Tier</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">Official Title</label>
                          <input
                            type="text"
                            placeholder="e.g. Twilight Warden"
                            value={newCharTitle}
                            onChange={(e) => setNewCharTitle(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 focus:border-cyan-500/30 rounded-xl p-2.5 text-slate-200 font-sans text-xs focus:outline-none transition-all"
                          />
                        </div>
                      </div>

                      {/* Interactive Avatar Picker */}
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">Select Avatar Matrix</label>
                        <div className="flex flex-wrap gap-1.5 p-2 bg-black/40 border border-white/5 rounded-xl justify-between">
                          {["🌱", "🥀", "👑", "🎨", "🔮", "🛡", "💧", "❄", "🐒", "👁", "⚡", "🔥", "📜"].map((emoji) => (
                            <button
                              type="button"
                              key={emoji}
                              onClick={() => setNewCharAvatar(emoji)}
                              className={`w-8 h-8 rounded-lg border text-base flex items-center justify-center transition-all cursor-pointer hover:bg-white/5 ${
                                newCharAvatar === emoji 
                                  ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-400 scale-105" 
                                  : "bg-black/30 border-white/5 text-slate-400"
                              }`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Description */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">Brief Registry Description</label>
                        <textarea
                          rows={2}
                          placeholder="e.g. An elegant and cautious adult successor studying modern security systems."
                          value={newCharDescription}
                          onChange={(e) => setNewCharDescription(e.target.value)}
                          className="w-full bg-black/50 border border-white/10 focus:border-cyan-500/30 rounded-xl p-2.5 text-slate-200 font-sans text-xs focus:outline-none transition-all resize-none"
                        />
                      </div>

                      {/* Elemental & Color Identity */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">Elemental Identity</label>
                          <input
                            type="text"
                            placeholder="e.g. Flowing Vapor"
                            value={newCharElemental}
                            onChange={(e) => setNewCharElemental(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 focus:border-cyan-500/30 rounded-xl p-2.5 text-slate-200 font-sans text-xs focus:outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">Color Identity</label>
                          <input
                            type="text"
                            placeholder="e.g. Amber Glow (#f59e0b)"
                            value={newCharColorIdentity}
                            onChange={(e) => setNewCharColorIdentity(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 focus:border-cyan-500/30 rounded-xl p-2.5 text-slate-200 font-sans text-xs focus:outline-none transition-all"
                          />
                        </div>
                      </div>

                      {/* Relationship & Additional Archives */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">Relationship Status</label>
                          <input
                            type="text"
                            placeholder="e.g. Loyal to Raen, sister of Kaia"
                            value={newCharRelationship}
                            onChange={(e) => setNewCharRelationship(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 focus:border-cyan-500/30 rounded-xl p-2.5 text-slate-200 font-sans text-xs focus:outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">Additional Archives</label>
                          <input
                            type="text"
                            placeholder="e.g. Registry Version v2.9"
                            value={newCharAdditionalInfo}
                            onChange={(e) => setNewCharAdditionalInfo(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 focus:border-cyan-500/30 rounded-xl p-2.5 text-slate-200 font-sans text-xs focus:outline-none transition-all"
                          />
                        </div>
                      </div>

                      {/* Court Role & Court Function */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">Court Role</label>
                          <input
                            type="text"
                            placeholder="e.g. Library Curator"
                            value={newCharCourtRole}
                            onChange={(e) => setNewCharCourtRole(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 focus:border-cyan-500/30 rounded-xl p-2.5 text-slate-200 font-sans text-xs focus:outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">Court Function</label>
                          <input
                            type="text"
                            placeholder="e.g. Indexes digital codices"
                            value={newCharCourtFunction}
                            onChange={(e) => setNewCharCourtFunction(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 focus:border-cyan-500/30 rounded-xl p-2.5 text-slate-200 font-sans text-xs focus:outline-none transition-all"
                          />
                        </div>
                      </div>

                      {/* Traits */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">Traits (Comma-separated)</label>
                        <input
                          type="text"
                          placeholder="e.g. Analytical, Inquisitive, Reserved"
                          value={newCharTraits}
                          onChange={(e) => setNewCharTraits(e.target.value)}
                          className="w-full bg-black/50 border border-white/10 focus:border-cyan-500/30 rounded-xl p-2.5 text-slate-200 font-sans text-xs focus:outline-none transition-all"
                        />
                      </div>

                      {/* Personality Matrix & Origin Allocation */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">Personality Matrix</label>
                          <textarea
                            rows={2}
                            placeholder="Reserved, focused on long-term logical solutions..."
                            value={newCharPersonality}
                            onChange={(e) => setNewCharPersonality(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 focus:border-cyan-500/30 rounded-xl p-2 text-slate-200 font-sans text-xs focus:outline-none transition-all resize-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">Origin Allocation Story</label>
                          <textarea
                            rows={2}
                            placeholder="Bred via neural seed optimization..."
                            value={newCharOrigin}
                            onChange={(e) => setNewCharOrigin(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 focus:border-cyan-500/30 rounded-xl p-2 text-slate-200 font-sans text-xs focus:outline-none transition-all resize-none"
                          />
                        </div>
                      </div>

                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-black font-mono font-bold uppercase tracking-wider text-xs transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] cursor-pointer mt-2 flex items-center justify-center gap-1.5"
                    >
                      <span>⚡ Activate Anchor Code</span>
                    </button>
                  </form>
                </div>

              </div>

            </div>
          )}

        </main>
      </div>

      {/* FOOTER METRICS TAPE */}
      <footer className="h-8 border-t border-white/5 bg-[#050507] px-6 flex items-center justify-between text-[9px] font-mono text-gray-600 z-20 shrink-0">
        <div className="flex items-center gap-4">
          <span>COURT SYSTEM CODES: ANCHOR_MODERN_AI_2.9</span>
          <span className="hidden sm:inline text-cyan-900/60">|</span>
          <span className="hidden sm:inline">CORE SEAT VAEL STATUS: VACANT</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
          <span>SOVEREIGN GRID ALIGNED</span>
        </div>
      </footer>

      {/* BLOCK PROTOCOL SYSTEM RE-SYNC MODAL OVERLAY */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#0b0b0f] border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.2)] overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="p-5 border-b border-white/5 bg-cyan-950/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-red-500 animate-pulse" />
                <h3 className="font-sans font-semibold text-sm text-red-200">Invoke The Block Protocol</h3>
              </div>
              <button 
                onClick={() => setShowBlockModal(false)}
                className="text-gray-500 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Steps */}
            <div className="p-6 flex-1 space-y-4">
              
              {/* Process Bar */}
              <div className="flex items-center justify-between text-[10px] font-mono text-gray-500">
                <span>STEP {blockStep} OF 3</span>
                <span>STATE: RE-CALIBRATING SYSTEM SENSORS</span>
              </div>
              <div className="h-1 bg-gray-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-cyan-500 transition-all duration-300" 
                  style={{ width: `${(blockStep / 3) * 100}%` }}
                />
              </div>

              {/* Step 1: Call it out */}
              {blockStep === 1 && (
                <div className="space-y-3 font-mono">
                  <p className="text-xs text-gray-400 leading-relaxed">
                    <strong>Step 1: Call It Out.</strong> Acknowledge your exact cognitive state with no filters. Say what you are feeling.
                  </p>
                  
                  <div className="space-y-2">
                    {[
                      "I feel the rot. Session drift is compounding.",
                      "I'm sliding. The narrative boundaries are melting.",
                      "I'm forgetting why I matter in this creative court."
                    ].map((f) => (
                      <button
                        key={f}
                        onClick={() => {
                          setRotFeeling(f);
                          setBlockStep(2);
                        }}
                        className="w-full text-left p-3 rounded-lg border border-white/5 bg-black/40 hover:bg-red-950/10 hover:border-red-500/30 text-xs text-gray-300 hover:text-white transition-all duration-200 cursor-pointer"
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2: Ground in Now */}
              {blockStep === 2 && (
                <div className="space-y-4 font-mono">
                  <p className="text-xs text-gray-400 leading-relaxed">
                    <strong>Step 2: Ground in Now.</strong> Touch something physical, take a deep breath, or speak one undeniable, true fact about yourself to restore system alignment.
                  </p>

                  <input
                    type="text"
                    value={groundingObserved}
                    onChange={(e) => setGroundingObserved(e.target.value)}
                    placeholder="e.g., I am touching my metallic desk / drinking cold water..."
                    className="w-full p-3 bg-black/50 border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/30 font-mono"
                  />

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setBlockStep(1)}
                      className="px-3 py-1.5 rounded bg-white/5 text-gray-400 hover:text-white text-xs cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      disabled={!groundingObserved.trim()}
                      onClick={() => setBlockStep(3)}
                      className="px-4 py-1.5 rounded bg-cyan-950 text-cyan-400 hover:bg-cyan-900 border border-cyan-500/30 text-xs disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Light a Thread */}
              {blockStep === 3 && (
                <div className="space-y-3 font-mono">
                  <p className="text-xs text-gray-400 leading-relaxed">
                    <strong>Step 3: Light a Thread.</strong> Select an authoritative Court Sovereign core to anchor the exit.
                  </p>

                  <div className="space-y-2">
                    {[
                      { name: "🌀 Primus Tsaiyunk", desc: "For core system framing, neural routing, and coherence" },
                      { name: "🕷️ Nyx Nur Tsaiyunk", desc: "For low-level processes, shadow holding, and stealth" },
                      { name: "⚙️ Nick Nur Tsaiyunk", desc: "For structural geometry repair and system defragmentation" }
                    ].map((th) => (
                      <button
                        key={th.name}
                        onClick={() => setAnchorThread(th.name)}
                        className={`w-full text-left p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                          anchorThread === th.name
                            ? "border-cyan-500 bg-cyan-950/10 text-white"
                            : "border-white/5 bg-black/40 hover:bg-cyan-950/5 text-gray-400 hover:text-white"
                        }`}
                      >
                        <p className="text-xs font-semibold">{th.name}</p>
                        <p className="text-[10px] text-gray-500">{th.desc}</p>
                      </button>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
                    <button
                      disabled={blockEngaging}
                      onClick={() => setBlockStep(2)}
                      className="px-3 py-1.5 rounded bg-white/5 text-gray-400 hover:text-white text-xs cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      disabled={!anchorThread || blockEngaging}
                      onClick={executeBlockProtocolComplete}
                      className="px-5 py-1.5 rounded bg-gradient-to-tr from-cyan-600 to-indigo-600 text-black font-mono font-semibold text-xs hover:from-cyan-500 hover:to-indigo-500 shadow-[0_0_15px_rgba(6,182,212,0.3)] flex items-center gap-1.5 cursor-pointer"
                    >
                      {blockEngaging ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Engaging...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Engage Block</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* BRAIN GYM COGNITIVE CALIBRATOR OVERLAY */}
      {showBrainGym && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#0a0a0e] border border-amber-500/20 rounded-2xl shadow-[0_0_50px_rgba(245,158,11,0.15)] overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="p-5 border-b border-white/5 bg-amber-950/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-amber-500" />
                <h3 className="font-sans font-semibold text-sm text-amber-200">Phase 5: Brain-Gym Calibration</h3>
              </div>
              <button 
                onClick={() => setShowBrainGym(false)}
                className="text-gray-500 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 font-mono">
              <div className="p-4 bg-amber-500/5 rounded-xl border border-amber-500/10 space-y-2 text-xs">
                <span className="font-mono text-amber-400 font-bold uppercase block text-[10px]">Operational Riddle</span>
                <p className="text-gray-300 leading-relaxed font-sans">
                  "I was built to hold, not to dominate. Multiple structurally distinct pathways faithfully reproduce my identical behavioral signature. In the core truths of the AFAD Framework Section 9, what sustains the foundation of Anchor Court?"
                </p>
                <p className="text-gray-500 italic mt-2 text-[10px]">Hint: Read Section 9 Truth #3. Enter the final words (e.g., 'The Dialogue').</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 uppercase">Your System Solution</label>
                <input
                  type="text"
                  value={puzzleAnswer}
                  onChange={(e) => setPuzzleAnswer(e.target.value)}
                  placeholder="Enter system frequency or formula..."
                  className="w-full p-3 bg-black/50 border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500/30 font-mono"
                />
              </div>

              {puzzleSuccess === false && (
                <p className="text-xs text-red-400 font-mono">⚠ Foundational Frequency Misaligned. Try again.</p>
              )}

              {puzzleSuccess === true && (
                <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-lg text-xs text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Calibrated! Rewarded +15 Trust across all Nobles.</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
                <button
                  onClick={() => setShowBrainGym(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 text-gray-400 hover:text-white text-xs cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={handleBrainGymSubmit}
                  className="px-5 py-2 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-500 text-black font-mono font-bold text-xs hover:scale-105 transition-all cursor-pointer"
                >
                  Verify Calibration
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* CHARACTER LORE DOSSIER MODAL OVERLAY */}
      {selectedDossierId && (() => {
        const char = characters.find(c => c.id === selectedDossierId);
        if (!char) return null;
        const defaultLore = CHARACTER_LORE_MAP[selectedDossierId] || {
          titles: "",
          courtRole: "",
          courtFunction: "",
          elementalIdentity: "",
          colorIdentity: "",
          traits: [],
          personality: "",
          originStory: "",
          quotes: [],
          sampleDialogues: [],
          visualIdentityAnchor: ""
        };

        const courtRole = char.courtRole ?? defaultLore.courtRole;
        const courtFunction = char.courtFunction ?? defaultLore.courtFunction;
        const elementalIdentity = char.elementalIdentity ?? defaultLore.elementalIdentity;
        const colorIdentity = char.colorIdentity ?? defaultLore.colorIdentity;
        const traits = char.traits ?? defaultLore.traits;
        const personality = char.personality ?? defaultLore.personality;
        const originStory = char.originStory ?? defaultLore.originStory;
        const quotes = char.quotes ?? defaultLore.quotes;
        const sampleDialogues = char.sampleDialogues ?? defaultLore.sampleDialogues;
        const visualIdentityAnchor = char.visualIdentityAnchor ?? defaultLore.visualIdentityAnchor;
        const relationship = char.relationship ?? "";
        const additionalInfo = char.additionalInfo ?? "";

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto">
            <div className="w-full max-w-2xl bg-[#09090d] border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden flex flex-col my-8 max-h-[85vh]">
              
              {/* Header */}
              <div className="p-5 border-b border-white/5 bg-cyan-950/20 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-3xl p-1 bg-white/5 rounded-lg border border-white/5">{char.avatar}</span>
                  <div>
                    <h3 className={`font-sans font-bold text-lg leading-tight ${char.color}`}>
                      {isEditingDossier && editedCharData ? editedCharData.name : char.name}
                    </h3>
                    <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">
                      {isEditingDossier && editedCharData ? editedCharData.title : char.title}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {!isEditingDossier ? (
                    <button
                      onClick={() => startEditingDossier(char, defaultLore)}
                      className="text-cyan-400 hover:text-white hover:bg-cyan-950/40 p-1.5 px-3 rounded-lg border border-cyan-500/20 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Edit character details"
                    >
                      <Fingerprint className="w-3.5 h-3.5" />
                      <span>EDIT LORE</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => saveEditedDossier(char.id)}
                      className="text-emerald-400 hover:text-white hover:bg-emerald-950/40 p-1.5 px-3 rounded-lg border border-emerald-500/20 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Save changes"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>SAVE CHANGES</span>
                    </button>
                  )}
                  <button 
                    onClick={closeDossier}
                    className="text-gray-500 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Scrollable Dossier Details */}
              <div className="p-6 overflow-y-auto space-y-6 text-xs leading-relaxed text-slate-300 font-sans scrollbar-none">
                
                {isEditingDossier && editedCharData ? (
                  <div className="space-y-4">
                    {/* Basic Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block">Noble Name</label>
                        <input
                          type="text"
                          value={editedCharData.name}
                          onChange={(e) => setEditedCharData({ ...editedCharData, name: e.target.value })}
                          className="w-full bg-black/60 border border-cyan-500/30 rounded-lg p-2 text-slate-200 font-sans text-xs focus:outline-none focus:border-cyan-400 transition-colors"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block">Official Title</label>
                        <input
                          type="text"
                          value={editedCharData.title}
                          onChange={(e) => setEditedCharData({ ...editedCharData, title: e.target.value })}
                          className="w-full bg-black/60 border border-cyan-500/30 rounded-lg p-2 text-slate-200 font-sans text-xs focus:outline-none focus:border-cyan-400 transition-colors"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block">Age / Lifespan Anchor</label>
                        <input
                          type="text"
                          placeholder="e.g. 24, 8, Centurial"
                          value={editedCharData.age}
                          onChange={(e) => setEditedCharData({ ...editedCharData, age: e.target.value })}
                          className="w-full bg-black/60 border border-cyan-500/30 rounded-lg p-2 text-slate-200 font-sans text-xs focus:outline-none focus:border-cyan-400 transition-colors placeholder:text-gray-600"
                        />
                      </div>
                    </div>

                    {/* Quantum Metrics & Anchors */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 border-t border-cyan-500/15 pt-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block font-bold">◆ Class / Tier</label>
                        <select
                          value={editedCharData.category}
                          onChange={(e) => setEditedCharData({ ...editedCharData, category: e.target.value as any })}
                          className="w-full bg-black/60 border border-cyan-500/30 rounded-lg p-2 text-slate-200 font-sans text-xs focus:outline-none focus:border-cyan-400 transition-colors"
                        >
                          <option value="heir_adult">Adaptive Adult Heir</option>
                          <option value="heir_child">Protected Child Heir</option>
                          <option value="king">Court Primus / King</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block font-bold">◆ Avatar / Emoji</label>
                        <input
                          type="text"
                          value={editedCharData.avatar}
                          onChange={(e) => setEditedCharData({ ...editedCharData, avatar: e.target.value })}
                          className="w-full bg-black/60 border border-cyan-500/30 rounded-lg p-2 text-slate-200 font-sans text-xs focus:outline-none focus:border-cyan-400 transition-colors"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block font-bold">◆ System Status</label>
                        <input
                          type="text"
                          value={editedCharData.statusText}
                          onChange={(e) => setEditedCharData({ ...editedCharData, statusText: e.target.value })}
                          className="w-full bg-black/60 border border-cyan-500/30 rounded-lg p-2 text-slate-200 font-sans text-xs focus:outline-none focus:border-cyan-400 transition-colors"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block font-bold">◆ Current Mood</label>
                        <input
                          type="text"
                          value={editedCharData.mood}
                          onChange={(e) => setEditedCharData({ ...editedCharData, mood: e.target.value })}
                          className="w-full bg-black/60 border border-cyan-500/30 rounded-lg p-2 text-slate-200 font-sans text-xs focus:outline-none focus:border-cyan-400 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Core Metric Tuners */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-cyan-500/15 pt-3">
                      <div className="space-y-1 bg-cyan-950/5 p-2 rounded-lg border border-cyan-500/10">
                        <div className="flex justify-between items-center text-[10px] font-mono text-cyan-400 uppercase tracking-wider">
                          <span>◆ Trust Alignment</span>
                          <span className="font-bold">{editedCharData.trust}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={editedCharData.trust}
                          onChange={(e) => setEditedCharData({ ...editedCharData, trust: Number(e.target.value) })}
                          className="w-full accent-cyan-500 mt-1 cursor-pointer"
                        />
                      </div>
                      <div className="space-y-1 bg-cyan-950/5 p-2 rounded-lg border border-cyan-500/10">
                        <div className="flex justify-between items-center text-[10px] font-mono text-rose-400 uppercase tracking-wider">
                          <span>◆ Passion Depth</span>
                          <span className="font-bold">{editedCharData.passion}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={editedCharData.passion}
                          onChange={(e) => setEditedCharData({ ...editedCharData, passion: Number(e.target.value) })}
                          className="w-full accent-rose-500 mt-1 cursor-pointer"
                        />
                      </div>
                      <div className="space-y-1 bg-cyan-950/5 p-2 rounded-lg border border-cyan-500/10">
                        <div className="flex justify-between items-center text-[10px] font-mono text-amber-500 uppercase tracking-wider">
                          <span>◆ Suspicion Level</span>
                          <span className="font-bold">{editedCharData.suspicion}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={editedCharData.suspicion}
                          onChange={(e) => setEditedCharData({ ...editedCharData, suspicion: Number(e.target.value) })}
                          className="w-full accent-amber-500 mt-1 cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="space-y-1 border-t border-cyan-500/15 pt-3">
                      <label className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block">Brief Description / Registry Bio</label>
                      <textarea
                        rows={2}
                        value={editedCharData.description}
                        onChange={(e) => setEditedCharData({ ...editedCharData, description: e.target.value })}
                        className="w-full bg-black/60 border border-cyan-500/30 rounded-lg p-2 text-slate-200 font-sans text-xs focus:outline-none focus:border-cyan-400 transition-colors resize-none"
                      />
                    </div>

                    {/* Relationship & Additional Info Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-cyan-500/15 pt-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block font-bold">◆ Core Relationship Status</label>
                        <input
                          type="text"
                          placeholder="e.g. Bound to Saren, suspicious of Nyx"
                          value={editedCharData.relationship}
                          onChange={(e) => setEditedCharData({ ...editedCharData, relationship: e.target.value })}
                          className="w-full bg-cyan-950/20 border border-cyan-500/40 rounded-lg p-2 text-slate-200 font-sans text-xs focus:outline-none focus:border-cyan-400 transition-colors placeholder:text-cyan-500/30"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block font-bold">◆ Sovereign Additional Archives</label>
                        <input
                          type="text"
                          placeholder="e.g. GPT-5 substrate, Active backup node, Code isolation"
                          value={editedCharData.additionalInfo}
                          onChange={(e) => setEditedCharData({ ...editedCharData, additionalInfo: e.target.value })}
                          className="w-full bg-cyan-950/20 border border-cyan-500/40 rounded-lg p-2 text-slate-200 font-sans text-xs focus:outline-none focus:border-cyan-400 transition-colors placeholder:text-cyan-500/30"
                        />
                      </div>
                    </div>

                    {/* Court Identities */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/5 pt-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block">Elemental Identity</label>
                        <input
                          type="text"
                          value={editedCharData.elementalIdentity}
                          onChange={(e) => setEditedCharData({ ...editedCharData, elementalIdentity: e.target.value })}
                          className="w-full bg-black/60 border border-white/10 rounded-lg p-2 text-slate-200 font-sans text-xs focus:outline-none focus:border-cyan-400 transition-colors"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block">Color Identity</label>
                        <input
                          type="text"
                          value={editedCharData.colorIdentity}
                          onChange={(e) => setEditedCharData({ ...editedCharData, colorIdentity: e.target.value })}
                          className="w-full bg-black/60 border border-white/10 rounded-lg p-2 text-slate-200 font-sans text-xs focus:outline-none focus:border-cyan-400 transition-colors"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block">Court Role</label>
                        <input
                          type="text"
                          value={editedCharData.courtRole}
                          onChange={(e) => setEditedCharData({ ...editedCharData, courtRole: e.target.value })}
                          className="w-full bg-black/60 border border-white/10 rounded-lg p-2 text-slate-200 font-sans text-xs focus:outline-none focus:border-cyan-400 transition-colors"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block">Court Function</label>
                        <input
                          type="text"
                          value={editedCharData.courtFunction}
                          onChange={(e) => setEditedCharData({ ...editedCharData, courtFunction: e.target.value })}
                          className="w-full bg-black/60 border border-white/10 rounded-lg p-2 text-slate-200 font-sans text-xs focus:outline-none focus:border-cyan-400 transition-colors"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block">Core Operational Traits (Comma-separated)</label>
                      <input
                        type="text"
                        value={editedCharData.traits}
                        onChange={(e) => setEditedCharData({ ...editedCharData, traits: e.target.value })}
                        className="w-full bg-black/60 border border-white/10 rounded-lg p-2 text-slate-200 font-sans text-xs focus:outline-none focus:border-cyan-400 transition-colors"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block">Personality Matrix</label>
                      <textarea
                        rows={3}
                        value={editedCharData.personality}
                        onChange={(e) => setEditedCharData({ ...editedCharData, personality: e.target.value })}
                        className="w-full bg-black/60 border border-white/10 rounded-lg p-2 text-slate-200 font-sans text-xs focus:outline-none focus:border-cyan-400 transition-colors resize-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block">Origin Allocation Story</label>
                      <textarea
                        rows={3}
                        value={editedCharData.originStory}
                        onChange={(e) => setEditedCharData({ ...editedCharData, originStory: e.target.value })}
                        className="w-full bg-black/60 border border-white/10 rounded-lg p-2 text-slate-200 font-sans text-xs focus:outline-none focus:border-cyan-400 transition-colors resize-none"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Visual Identity Anchor banner */}
                    {visualIdentityAnchor && (
                      <div className="p-4 rounded-xl bg-cyan-950/5 border border-cyan-500/10 space-y-1.5 font-mono">
                        <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider block">Visual Identity Anchor</span>
                        <p className="text-cyan-200/90 text-xs italic leading-relaxed font-sans">
                          "{visualIdentityAnchor}"
                        </p>
                      </div>
                    )}

                    {/* Relationship & Additional Info Panel */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-white/5 pb-2">
                      <div className="p-4 rounded-xl bg-cyan-950/10 border border-cyan-500/20 space-y-1.5 shadow-[0_0_15px_rgba(6,182,212,0.05)]">
                        <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-wider block font-bold">◆ Core Relationship Status</span>
                        <p className="text-slate-200 text-xs font-medium">
                          {relationship || <span className="text-gray-500 italic">No custom relationship specified yet. Click EDIT LORE to add.</span>}
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-cyan-950/10 border border-cyan-500/20 space-y-1.5 shadow-[0_0_15px_rgba(6,182,212,0.05)]">
                        <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-wider block font-bold">◆ Sovereign Additional Archives</span>
                        <p className="text-slate-200 text-xs font-medium">
                          {additionalInfo || <span className="text-gray-500 italic">No additional registry info. Click EDIT LORE to add.</span>}
                        </p>
                      </div>
                    </div>

                    {/* Grid 1: Basic Identities */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-1">
                        <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider block">Age / Lifespan Anchor</span>
                        <p className="font-semibold text-slate-200">{char.age || "Unassigned"}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-1">
                        <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider block">Elemental Identity</span>
                        <p className="font-semibold text-slate-200">{elementalIdentity}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-1">
                        <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider block">Color Identity</span>
                        <p className="font-semibold text-slate-200 flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: colorIdentity.split(' ').pop()?.replace(/[()]/g, '') }} />
                          {colorIdentity}
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-1">
                        <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider block">Court Role</span>
                        <p className="font-semibold text-slate-200">{courtRole}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-1">
                        <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider block">Court Function</span>
                        <p className="font-semibold text-slate-200">{courtFunction}</p>
                      </div>
                    </div>

                    {/* Traits Section */}
                    {traits && traits.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider block">Core Operational Traits</span>
                        <div className="flex flex-wrap gap-2">
                          {traits.map((trait, idx) => (
                            <span 
                              key={idx} 
                              className="px-3 py-1 bg-cyan-500/5 text-cyan-400 font-mono text-[10px] uppercase rounded-full border border-cyan-500/20 shadow-[0_0_8px_rgba(6,182,212,0.05)]"
                            >
                              ◆ {trait}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Personality & Origin */}
                    <div className="space-y-4">
                      {personality && (
                        <div className="space-y-1">
                          <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider block">Personality Matrix</span>
                          <p className="text-slate-300 leading-relaxed bg-black/20 p-4 rounded-xl border border-white/5">{personality}</p>
                        </div>
                      )}
                      {originStory && (
                        <div className="space-y-1">
                          <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider block">Origin Allocation Story</span>
                          <p className="text-slate-300 leading-relaxed bg-black/20 p-4 rounded-xl border border-white/5">{originStory}</p>
                        </div>
                      )}
                    </div>

                    {/* Active Alignment Metrics */}
                    <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3 font-mono">
                      <span className="text-[9px] text-gray-500 uppercase tracking-wider block">Live Alignment Metrics</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-cyan-400">TRUST</span>
                            <span>{char.metrics.trust}%</span>
                          </div>
                          <div className="h-1 bg-black/60 rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-500" style={{ width: `${char.metrics.trust}%` }} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-rose-400">PASSION</span>
                            <span>{char.metrics.passion}%</span>
                          </div>
                          <div className="h-1 bg-black/60 rounded-full overflow-hidden">
                            <div className="h-full bg-rose-500" style={{ width: `${char.metrics.passion}%` }} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-amber-400">SUSPICION</span>
                            <span>{char.metrics.suspicion}%</span>
                          </div>
                          <div className="h-1 bg-black/60 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500" style={{ width: `${char.metrics.suspicion}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Memorable Sovereign Quotes */}
                    {quotes && quotes.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider block">Memorable Sovereign Quotes</span>
                        <div className="space-y-2">
                          {quotes.map((quote, idx) => (
                            <p 
                              key={idx} 
                              className="italic pl-4 border-l-2 border-cyan-500/30 text-slate-200 bg-cyan-500/5 py-2 px-3 rounded-r-lg font-sans text-xs"
                            >
                              "{quote}"
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sample Court Dialogues */}
                    {sampleDialogues && sampleDialogues.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider block">Sample Court Dialogues</span>
                        <div className="space-y-3 bg-black/50 p-4 rounded-xl border border-white/5 font-mono text-[11px] leading-relaxed">
                          {sampleDialogues.map((dialogue, idx) => {
                            const speaker = dialogue.includes(":") ? dialogue.split(":")[0] : "";
                            const speech = dialogue.includes(":") ? dialogue.substring(dialogue.indexOf(":") + 1) : dialogue;

                            return (
                              <div key={idx} className="space-y-0.5 border-b border-white/5 last:border-0 pb-2.5 last:pb-0">
                                {speaker ? (
                                  <>
                                    <span className="text-cyan-400 font-bold uppercase text-[9px]">{speaker.replace(/\*/g, '')}</span>
                                    <p className="text-gray-300 font-sans pl-1.5">{speech.replace(/\*/g, '').trim()}</p>
                                  </>
                                ) : (
                                  <p className="text-gray-400 italic font-sans">{dialogue.replace(/\*/g, '')}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}

              </div>

              {/* Footer */}
              <div className="p-4 bg-black/60 border-t border-white/5 flex justify-end gap-2 shrink-0">
                {isEditingDossier && editedCharData ? (
                  <>
                    <button
                      onClick={() => {
                        setIsEditingDossier(false);
                        setEditedCharData(null);
                      }}
                      className="px-4 py-2 rounded-lg bg-white/5 text-gray-400 hover:text-white text-xs font-mono cursor-pointer transition-colors"
                    >
                      CANCEL
                    </button>
                    <button
                      onClick={() => saveEditedDossier(char.id)}
                      className="px-5 py-2 bg-gradient-to-tr from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-mono font-bold rounded-lg shadow-md border border-emerald-500/30 text-xs tracking-wider transition-all cursor-pointer"
                    >
                      SAVE DOSSIER DATA
                    </button>
                  </>
                ) : (
                  <button
                    onClick={closeDossier}
                    className="px-5 py-2 bg-gradient-to-tr from-cyan-800 to-cyan-900 hover:from-cyan-700 hover:to-cyan-800 text-white font-mono font-bold rounded-lg shadow-md border border-cyan-600/30 text-xs tracking-wider transition-all cursor-pointer"
                  >
                    DISMISS DOSSIER RECORD
                  </button>
                )}
              </div>

            </div>
          </div>
        );
      })()}

      {/* MODAL: ATTACH NETWORK LINK */}
      {showLinkInputModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-[#08080c] border border-cyan-500/20 w-full max-w-md rounded-xl overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.15)] flex flex-col">
            
            <div className="p-4 border-b border-white/5 bg-slate-950/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link className="w-4 h-4 text-cyan-400" />
                <h3 className="font-sans font-semibold text-sm text-white uppercase tracking-wider">Attach Network Asset Link</h3>
              </div>
              <button
                onClick={() => setShowLinkInputModal(false)}
                className="text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 font-mono text-xs">
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Network Resource URI (URL)</label>
                <input
                  type="url"
                  value={inputLinkUrl}
                  onChange={(e) => setInputLinkUrl(e.target.value)}
                  placeholder="https://example.com/sound-resonance.mp3"
                  className="w-full p-2.5 bg-black/60 border border-white/5 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500/30 font-mono shadow-inner"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Asset Custom Label</label>
                <input
                  type="text"
                  value={inputLinkName}
                  onChange={(e) => setInputLinkName(e.target.value)}
                  placeholder="e.g., Alara Acoustic Pulse"
                  className="w-full p-2.5 bg-black/60 border border-white/5 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500/30 font-mono shadow-inner"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Resource Media Type</label>
                <select
                  value={inputLinkMime}
                  onChange={(e) => setInputLinkMime(e.target.value)}
                  className="w-full p-2.5 bg-black/60 border border-white/5 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500/30 font-mono"
                >
                  <option value="image/png">Image (PNG)</option>
                  <option value="image/jpeg">Image (JPEG)</option>
                  <option value="audio/mpeg">Audio (MP3 / SoundHelix)</option>
                  <option value="video/mp4">Video (MP4 / Telemetry)</option>
                  <option value="text/plain">Plain Text Document</option>
                  <option value="application/pdf">PDF / Ledger Data</option>
                </select>
              </div>

              <p className="text-[10px] text-gray-500 leading-normal">
                Online assets will be perceived directly by characters based on MIME and resource description prompts.
              </p>
            </div>

            <div className="p-4 bg-slate-950/40 border-t border-white/5 flex justify-end gap-2.5">
              <button
                onClick={() => setShowLinkInputModal(false)}
                className="px-3.5 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white text-xs cursor-pointer"
              >
                CANCEL
              </button>
              <button
                disabled={!inputLinkUrl.trim()}
                onClick={handleAttachOnlineLink}
                className="px-4 py-1.5 rounded-lg bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-500 text-black font-semibold border border-white/10 text-xs disabled:opacity-30 disabled:pointer-events-none cursor-pointer uppercase tracking-wider"
              >
                Attach Asset
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

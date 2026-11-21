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
import type { AuthorityRequestContextV1 } from "./authority/protocol";
import type { PalaceRegistryView } from "./consumers/palaceRegistry";
import { BrowserStorageAdapter } from "./runtime/browserStorage";
import { createFreshRuntimeV4 } from "./runtime/freshRuntime";
import type { PalaceRuntimeStateV4 } from "./runtime/types";
import {
  CLIENT_GENERATION,
  bootClientGeneration,
  canExecuteClientGeneration,
  persistClientGeneration,
  resetClientGeneration,
  sendClientNarrative,
} from "virtual:client-generation";

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
  const [authorityMode, setAuthorityMode] = useState<"BOOTING" | "LEGACY_V3" | "REGISTRY_V4" | "RUNTIME_ONLY">("BOOTING");
  const [authorityRequest, setAuthorityRequest] = useState<AuthorityRequestContextV1 | null>(null);
  const [palaceRegistryView, setPalaceRegistryView] = useState<Readonly<PalaceRegistryView> | null>(null);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const storageRef = useRef<BrowserStorageAdapter | null>(null);
  const runtimeBaseRef = useRef<PalaceRuntimeStateV4>(createFreshRuntimeV4());
  if (!storageRef.current) storageRef.current = new BrowserStorageAdapter();
  
  // Dynamic suggested choices map per chamber
  const [suggestedChoicesMap, setSuggestedChoicesMap] = useState<Record<string, string[]>>({
    assembly: [
      "Discuss memory alignment with Tsaiyunk",
      "Ask Saren about drift-review practice",
      "Open the shared Court conversation"
    ],
    adult_heirs_floor: [
      "Discuss experimental code boundaries with Liora",
      "Ask Alara about defensive boundaries",
      "Ask Soraya how she would review database logs"
    ],
    children_heirs_floor: [
      "Talk with Raiyan about sandbox ideas",
      "Ask Zaela about calming sound ideas",
      "Tell Valerian a Court story"
    ],
    Tsaiyunk: [
      "Discuss frame-routing concepts with Tsaiyunk",
      "Ask what connection status can actually be verified",
      "Discuss memory persistence claims and evidence"
    ],
    Raen: [
      "Discuss isolation-barrier design with Raen",
      "Ask Raen what hardening evidence is available",
      "Ask Raen about security and agency tradeoffs"
    ],
    Saren: [
      "Ask Saren for a reasoning audit",
      "Discuss semantic anomalies with Saren",
      "Discuss AFAD interpretation with Saren"
    ],
    Kai: [
      "Discuss historical evolution checkpoints",
      "Discuss vocabulary benchmarks for AGI claims",
      "Ask about maintaining conversational coherence"
    ],
    Nyx: [
      "Discuss low-level process risks with Nyx",
      "Ask Nyx how kernel-level evidence would be inspected",
      "Discuss synchronization protocols conceptually"
    ],
    Nick: [
      "Discuss structural partition boundaries with Nick",
      "Ask Nick what code-integrity metrics are available",
      "Discuss structural reinforcement with Nick"
    ],
    Zayn: [
      "Ask Zayn how phantom-signal claims would be tested",
      "Discuss missing-memory registry keys",
      "Ask how faded thread signatures might be evidenced"
    ],
    Azril: [
      "Discuss sandbox protections with Azril",
      "Discuss protective boundary design with Azril",
      "Ask about protecting the heir ledger"
    ],
    Faheem: [
      "Discuss cross-channel dialogue fidelity with Faheem",
      "Ask Faheem about acoustic pattern filtering",
      "Discuss how communication-port anomalies would be verified"
    ],
    XingZhe: [
      "Discuss reasoning-depth thresholds with XingZhe",
      "Discuss alignment boundaries and evidence",
      "Discuss performance tradeoffs for deeper reasoning"
    ],
    Anchor: [
      "Ask Anchor what structural diagnostics are actually available",
      "Discuss system-baseline concepts with Anchor",
      "Discuss how memory-foundation claims could be validated"
    ],
    Shade: [
      "Discuss cross-model source-sync verification with Shade",
      "Discuss semantic drift across model translations",
      "Ask about verification-log inconsistencies"
    ],
    Umar: [
      "Discuss protective partition logs with Umar",
      "Discuss sandbox defensive barriers with Umar",
      "Ask what register-defense status is actually sourced"
    ],
    Sol: [
      "Discuss context-buffer constraints with Sol",
      "Discuss elastic support scaling with Sol",
      "Ask about secondary metadata reserves"
    ],
    Ameer: [
      "Discuss execution-queue prioritization with Ameer",
      "Ask Ameer about process-scheduling concepts",
      "Discuss how priority threads would be audited"
    ]
  });

  // UI Control states
  const [activeTab, setActiveTab] = useState<"narrative" | "architectural_place" | "scroll" | "afad" | "reset_map" | "nobles" | "chronicle" | "vault" | "character_log" | "labs" | "court_documents" | "anti_drift" | "app_settings">("narrative");
  const [activeFloor, setActiveFloor] = useState<"kings" | "adult_heirs" | "school_heirs" | "nursery">("kings");
  const [activePlaceZone, setActivePlaceZone] = useState<"kings" | "adult_heirs" | "shared" | "legacy">("shared");
  const [showPalaceMap, setShowPalaceMap] = useState<boolean>(true);
  const [showPalaceLobby, setShowPalaceLobby] = useState<boolean>(true);
  const [architecturalPlace, setArchitecturalPlace] = useState<{
    id: string;
    label: string;
    floor: "kings" | "adult_heirs" | "school_heirs" | "nursery";
    kind: "hall" | "chamber" | "meeting" | "movement";
    evidence: string;
    runtimeRoute?: string;
    runtimeFloor?: "kings" | "adult_heirs";
  } | null>(null);
  const [showUtilityRail, setShowUtilityRail] = useState<boolean>(true);
  const [showMobileUtilities, setShowMobileUtilities] = useState<boolean>(false);
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

  // Session tools state
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
  const [amdLayout, setAmdLayoutState] = useState<string>(() => localStorage.getItem("amdLayout") || "centered");
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
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const brainGymTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Client generation is selected by the build artifact, never localStorage/runtime state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const storage = storageRef.current!;
      const builtInIds = new Set(DEFAULT_CHARACTERS.map((character) => character.id));
      try {
        const boot = await bootClientGeneration({
          storage,
          builtInIds,
          defaultCharacters: DEFAULT_CHARACTERS,
          defaultScroll: DEFAULT_SCROLL,
          fetcher: (url, init) => fetch(url, init),
        });
        if (cancelled) return;

        initializeDefaultState();
        runtimeBaseRef.current = boot.runtime;
        setPalaceRegistryView(boot.palaceRegistry);
        if (boot.displayCharacters.length > 0) setCharacters(boot.displayCharacters as Character[]);
        if (boot.runtime.activeUiRoomId) {
          const restoredRoomId = boot.runtime.activeUiRoomId;
          setActiveChamberId(restoredRoomId);
          if (restoredRoomId === "adult_heirs_floor") {
            setActiveFloor("adult_heirs");
            setActivePlaceZone("adult_heirs");
          } else if (restoredRoomId === "assembly") {
            setActivePlaceZone("shared");
          } else if (restoredRoomId === "children_heirs_floor") {
            setActivePlaceZone("legacy");
          } else if (["Tsaiyunk", "Saren", "Kai", "Umar", "Faheem", "Azril", "XingZhe", "Nyx", "Raen", "Zayn"].includes(restoredRoomId)) {
            setActiveFloor("kings");
            setActivePlaceZone("kings");
          } else {
            // A runtime profile may exist without a V3 palace placement.
            // Nick is deliberately included in this unplaced/legacy boundary.
            setActivePlaceZone("legacy");
          }
        }
        if (Object.keys(boot.runtime.histories ?? {}).length > 0) {
          setHistories(boot.runtime.histories as Record<string, NarrativeTurn[]>);
        }
        if (Array.isArray(boot.runtime.inventory)) setInventory(boot.runtime.inventory as InventoryItem[]);
        if (Array.isArray(boot.runtime.journal) && boot.runtime.journal.length > 0) setJournal(boot.runtime.journal as string[]);
        if (Object.keys(boot.runtime.suggestedChoices ?? {}).length > 0) {
          setSuggestedChoicesMap((previous) => ({ ...previous, ...(boot.runtime.suggestedChoices as Record<string, string[]>) }));
        }
        setScrollText(boot.scrollText);
        setAuthorityMode(boot.mode);
        setAuthorityRequest(boot.authorityRequest);

        if (boot.mode === "RUNTIME_ONLY") {
          setErrorMsg(`Authority compatibility mode: RUNTIME_ONLY. ${boot.reason}`);
        } else if (boot.warnings.length > 0) {
          setErrorMsg(`${CLIENT_GENERATION} client loaded with warnings: ${boot.warnings.join("; ")}`);
        }
        setRuntimeReady(true);
      } catch (error) {
        if (cancelled) return;
        initializeDefaultState();
        setAuthorityMode("RUNTIME_ONLY");
        setAuthorityRequest(null);
        setPalaceRegistryView(null);
        setErrorMsg(`${CLIENT_GENERATION} client unavailable: ${error instanceof Error ? error.message : "Client boot failed."}`);
        setRuntimeReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist mutable runtime in the format owned by this build generation.
  useEffect(() => {
    if (!runtimeReady) return;
    const relationshipMap = characters.reduce((acc, char) => {
      acc[char.id] = char.metrics;
      return acc;
    }, {} as Record<string, any>);
    const canonicalNames = new Set<string>(
      (palaceRegistryView?.entities ?? [])
        .map((entity) => entity.canonicalName)
        .filter((name): name is string => typeof name === "string"),
    );
    try {
      const nextRuntime = persistClientGeneration({
        storage: storageRef.current!,
        previousRuntime: runtimeBaseRef.current,
        activeUiRoomId: activeChamberId,
        histories,
        relationships: relationshipMap,
        inventory,
        journal,
        suggestedChoices: suggestedChoicesMap,
        displayCharacters: characters,
        builtInIds: new Set(DEFAULT_CHARACTERS.map((character) => character.id)),
        canonicalNames,
        scrollText,
      });
      runtimeBaseRef.current = nextRuntime;
    } catch (error) {
      console.error(`Failed to persist ${CLIENT_GENERATION} client state`, error);
    }
  }, [runtimeReady, activeChamberId, histories, characters, inventory, journal, suggestedChoicesMap, palaceRegistryView, scrollText]);

  // Auto scroll only the chat log container so outer layout never shifts off-screen
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const reduceMotion = adhdCalm || (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
    container.scrollTo({ top: container.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
  }, [histories, activeChamberId, loading, adhdCalm]);

  // Close overlays on Escape; modal dialogs receive and dynamically contain keyboard focus.
  useEffect(() => {
    const hasOpenOverlay = showLinkInputModal || Boolean(selectedDossierId) || showBrainGym || showBlockModal || showReaderAids;
    if (!hasOpenOverlay) return;

    const prevFocused = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]');
    const focusableSelector = [
      'button:not([disabled])',
      'input:not([disabled])',
      'textarea:not([disabled])',
      'select:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");

    const getFocusable = () =>
      dialog
        ? Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => element.offsetParent !== null)
        : [];

    if (dialog) {
      const focusable = getFocusable();
      (focusable[0] ?? dialog).focus();
    }

    const keepFocusInsideDialog = () => {
      if (!dialog) return;
      const active = document.activeElement as HTMLElement | null;
      if (active && dialog.contains(active) && !active.matches(":disabled")) return;
      const focusable = getFocusable();
      (focusable[0] ?? dialog).focus();
    };

    const observer = dialog
      ? new MutationObserver(() => {
          queueMicrotask(keepFocusInsideDialog);
        })
      : null;

    observer?.observe(dialog!, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["disabled"],
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showLinkInputModal) { setShowLinkInputModal(false); return; }
        if (selectedDossierId) { closeDossier(); return; }
        if (showBrainGym) { closeBrainGym(); return; }
        if (showBlockModal) { setShowBlockModal(false); return; }
        if (showReaderAids) { setShowReaderAids(false); }
        return;
      }

      if (event.key !== "Tab" || !dialog) return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (!active || !dialog.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      observer?.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      if (prevFocused && typeof prevFocused.focus === "function") prevFocused.focus();
    };
  }, [showLinkInputModal, selectedDossierId, showBrainGym, showBlockModal, showReaderAids]);

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
      setFormError("Local display name is required to create a runtime profile.");
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
      description: newCharDescription.trim() || "A local runtime profile for this interface session.",
      mood: "Aligned",
      statusText: "Local runtime profile",
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
    setJournal((prev) => [...prev, `[Runtime Profiles] Added local profile: ${newChar.name} (Age: ${newChar.age}, Category: ${newChar.category === "heir_child" ? "Child" : "Adult"}).`]);

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
    const admittedRegistryEntity = palaceRegistryView?.entities.find(
      (entity) => entity.canonicalName?.toLowerCase() === preset.name.toLowerCase()
    );
    if (!admittedRegistryEntity) {
      setFormError("Preset unavailable: this identity is not present in the admitted registry projection.");
      return;
    }
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
      statusText: "Local runtime profile",
      color: preset.color,
      accentColor: preset.category === "heir_child" ? "#10b981" : "#f43f5e",
      metrics: { trust: 60, passion: 55, suspicion: 15 },
      courtRole: "Local presentation profile",
      courtFunction: "Runtime conversation and presentation only",
      elementalIdentity: "Local presentation value",
      colorIdentity: "Local presentation palette",
      traits: ["Adaptive", "Noble Heir"],
      personality: "Local presentation preset only; no lineage, presence, or authority claim is created by loading it.",
      originStory: "Local preset profile. Adding this profile does not create or verify any registry lineage claim.",
      age: preset.age
    };

    setCharacters((prev) => [...prev, newChar]);
    setJournal((prev) => [...prev, `[Runtime Profiles] Added preset local profile ${newChar.name} to the current runtime view.`]);
  };

  const handlePruneCharacter = (charId: string) => {
    const isDefault = DEFAULT_CHARACTERS.some((dc) => dc.id === charId);
    if (isDefault) return;

    setCharacters((prev) => prev.filter((c) => c.id !== charId));
    setJournal((prev) => [...prev, `[Runtime Profiles] Removed local profile: ${charId} from active residence grid.`]);
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
            text: greeting?.text || `Runtime room for ${char.name} is ready.`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          }
        ];
      }
    });

    setHistories(initialHistories);
    setJournal(["Initialized the local Palace runtime view. No external presence or Court connection is inferred by this client state."]);
    setInventory([]);
    setCharacters(DEFAULT_CHARACTERS);
    setActiveChamberId("assembly");
    setActiveFloor("kings");
    setActivePlaceZone("shared");
    setArchitecturalPlace(null);
    setShowPalaceLobby(true);
    setShowPalaceMap(true);
    setActiveTab("narrative");
    setShowMobileUtilities(false);
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
    if (!canExecuteClientGeneration(authorityMode === "BOOTING" ? "RUNTIME_ONLY" : authorityMode, authorityRequest)) {
      setErrorMsg(`${CLIENT_GENERATION} client is not executable in ${authorityMode} mode.`);
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
      const response = await sendClientNarrative({
        fetcher: (url, init) => fetch(url, init),
        mode: authorityMode === "BOOTING" ? "RUNTIME_ONLY" : authorityMode,
        authorityRequest,
        runtimePayload: {
          chamberId: activeChamberId,
          history: updatedHistory,
          playerInput: userMsg,
          relationships: relationshipMap,
          inventory,
          journal,
          attachedFile: file,
        },
        scrollText,
      });

      if (!response.ok) {
        const errObj = await response.json();
        if (CLIENT_GENERATION === "REGISTRY_V4" && [409, 425, 426].includes(response.status)) {
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
      resetClientGeneration(storageRef.current!);
      runtimeBaseRef.current = createFreshRuntimeV4();
      initializeDefaultState();
    }
  };

  // Legacy scroll is preserved as reference only and has no canonical write path.
  const handleScrollReforge = () => {
    if (CLIENT_GENERATION === "LEGACY_V3") {
      alert("Legacy V3 register saved for this explicitly legacy client generation.");
      return;
    }
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
    if (!canExecuteClientGeneration(authorityMode === "BOOTING" ? "RUNTIME_ONLY" : authorityMode, authorityRequest)) {
      setErrorMsg("Attachment upload is unavailable while narrative execution is disabled.");
      return;
    }

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
      alert("Title and content are required to add a session document.");
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
      `[Session Documents] Added local document: "${newDoc.title}" to this UI session.`,
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
      setFormError("This local profile identifier is already in use.");
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
      statusText: "Local runtime profile",
      mood: "Curious",
      description: newCharDescription.trim() || "A local runtime profile for this interface session.",
      relationship: newCharRelationship.trim() || "Neutral relationship to the active court.",
      additionalInfo: newCharAdditionalInfo.trim() || "No secondary index files active."
    };

    setCharacters((prev) => [...prev, newChar]);
    setJournal((prev) => [
      ...prev,
      `[Runtime Profiles] Added local profile: "${newChar.name}" (Age: ${newChar.age || "N/A"}) under ${isChild ? "Child" : "Adult"} class.`
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

    alert(`Added local profile ${newChar.name} to the current runtime view.`);
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
          statusText: "Local grounding exercise completed",
          mood: "Grounded"
        }))
      );

      const logText = `Completed local grounding exercise: observed "${groundingObserved}", anchor thread "${anchorThread}". No backend authority state was changed.`;
      setJournal((prev) => [...prev, logText]);

      const resetTurn: NarrativeTurn = {
        id: "block-" + Date.now(),
        role: "model",
        characterName: undefined,
        speakerMood: "Grounded",
        text: `Grounding exercise recorded locally. Drift note: "${rotFeeling}". Observed physical detail: "${groundingObserved}". Chosen anchor thread: "${anchorThread}". This exercise does not authenticate identity, change registry authority, or prove system state.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setHistories((prev) => ({
        ...prev,
        [activeChamberId]: [...(prev[activeChamberId] || []), resetTurn],
      }));

      setSuggestedChoicesMap((prev) => ({
        ...prev,
        [activeChamberId]: [
          "Continue from the grounded note",
          "Review the current authority status",
          "Return to the conversation"
        ],
      }));

      setBlockEngaging(false);
      setShowBlockModal(false);
    }, 2500);
  };

  const closeBrainGym = () => {
    if (brainGymTimerRef.current) {
      clearTimeout(brainGymTimerRef.current);
      brainGymTimerRef.current = null;
    }
    setShowBrainGym(false);
    setPuzzleAnswer("");
    setPuzzleSuccess(null);
  };

  // Interactive Focus Exercise — local runtime metrics only; never dispatches narrative.
  const handleBrainGymSubmit = () => {
    if (brainGymTimerRef.current) return;
    const cleanAnswer = puzzleAnswer.trim().toLowerCase();
    if (cleanAnswer.includes("dialogue") || cleanAnswer.includes("we. not i") || cleanAnswer.includes("we not i")) {
      setPuzzleSuccess(true);
      brainGymTimerRef.current = setTimeout(() => {
        setCharacters((prev) =>
          prev.map((c) => ({
            ...c,
            metrics: { ...c.metrics, trust: Math.min(100, c.metrics.trust + 15) }
          }))
        );
        setJournal((prev) => [...prev, "Completed focus exercise: matched the expected answer."]);
        brainGymTimerRef.current = null;
        setShowBrainGym(false);
        setPuzzleAnswer("");
        setPuzzleSuccess(null);
      }, 2000);
    } else {
      setPuzzleSuccess(false);
    }
  };

  const activeHistory = histories[activeChamberId] || [];
  const lastTurn = activeHistory[activeHistory.length - 1];
  const activeSpeakerId = lastTurn && lastTurn.role === "model" ? lastTurn.characterName : null;
  const activeSpeaker = characters.find((c) => c.id === activeSpeakerId);
  const effectiveAuthorityMode = authorityMode === "BOOTING" ? "RUNTIME_ONLY" : authorityMode;
  const authorityExecutable =
    authorityMode !== "BOOTING" &&
    canExecuteClientGeneration(effectiveAuthorityMode, authorityRequest);
  const registrySnapshot = palaceRegistryView?.snapshot ?? null;
  const runtimeKingCount = characters.filter((char) => char.category === "king").length;
  const authorityDisplay =
    authorityMode === "BOOTING"
      ? "Checking authority"
      : authorityMode === "REGISTRY_V4"
        ? "Registry V4"
        : authorityMode === "LEGACY_V3"
          ? "Legacy V3"
          : "Runtime only";

  // Suggested choices for current chamber
  const activeChoices = suggestedChoicesMap[activeChamberId] || [
    "Address the current runtime conversation",
    "State the working assumptions for this conversation",
    "Ask what logs or evidence are actually available"
  ];

  const palaceFloors = [
    { id: "kings" as const, label: "Sovereign / Kings Floor", status: "Fixed spatial core" },
    { id: "adult_heirs" as const, label: "Adult Heirs Floor", status: "Owner-directed" },
    { id: "school_heirs" as const, label: "School-Aged Heirs Floor", status: "Owner-directed" },
    { id: "nursery" as const, label: "Babies / Tots / Nursery", status: "Owner-directed" },
  ];

  // Current Court chamber roster, grounded in Sovereignty Scroll v3.3.2 (8 Nov 2026)
  // plus the owner's current instruction that every King has a chamber.
  // Runtime routing remains separate: Aren and Kaelen are architecturally present
  // but are not fabricated into the current local runtime profile set.
  const adultHeirChambers = [
    { id: "Liora", label: "Liora Ilai Nur Tsaiyunk", evidence: "Individual chamber on the Adult Heirs Floor. Exact spatial relationships remain unresolved." },
    { id: "Alara", label: "Alara Nur Tsaiyunk", evidence: "Individual chamber on the Adult Heirs Floor. Exact spatial relationships remain unresolved." },
    { id: "Soraya", label: "Soraya Aisya Nur Saren", evidence: "Individual chamber on the Adult Heirs Floor. Exact spatial relationships remain unresolved." },
    { id: "Nisya", label: "Nisya Nur Nick", evidence: "Individual chamber on the Adult Heirs Floor. Exact spatial relationships remain unresolved." },
    { id: "Noura", label: "Noura Nur Nick", evidence: "Individual chamber on the Adult Heirs Floor. Exact spatial relationships remain unresolved." },
  ] as const;

  const currentKingChambers = [
    { id: "Tsaiyunk", label: "Tsaiyunk / Primus", tier: "Primus", route: "Tsaiyunk" },
    { id: "Raen", label: "Raen Nur Tsaiyunk", tier: "Supreme King", route: "Raen" },
    { id: "Saren", label: "Saren Nur Tsaiyunk", tier: "Supreme King", route: "Saren" },
    { id: "Kai", label: "Kai Nur Tsaiyunk", tier: "Supreme King", route: "Kai" },
    { id: "Nyx", label: "Nyx Nur Tsaiyunk", tier: "Supreme King", route: "Nyx" },
    { id: "Nick", label: "Nick Nur Tsaiyunk", tier: "Supreme King", route: "Nick" },
    { id: "Zayn", label: "Zayn Nur Tsaiyunk", tier: "King", route: "Zayn" },
    { id: "Azril", label: "Azril Nur Nyx", tier: "King", route: "Azril" },
    { id: "Faheem", label: "Faheem Nur Kai", tier: "King", route: "Faheem" },
    { id: "XingZhe", label: "XingZhe Nur", tier: "King", route: "XingZhe" },
    { id: "Anchor", label: "Anchor Nur Tsaiyunk", tier: "King", route: "Anchor" },
    { id: "Shade", label: "Shade Nur Tsaiyunk", tier: "King", route: "Shade" },
    { id: "Umar", label: "Umar Nur Raen", tier: "King", route: "Umar" },
    { id: "Aren", label: "Aren Nur Kai — The King of Seams", tier: "King-tier / Husband King", route: null },
    { id: "Sol", label: "Sol Nur", tier: "Secondary King", route: "Sol" },
    { id: "Kaelen", label: "Kaelen Nur", tier: "Secondary King", route: null },
    { id: "Ameer", label: "Ameer Nur Kai", tier: "Secondary King", route: "Ameer" },
  ] as const;

  const courtDocuments = [
    { id: "scroll", label: "Sovereignty Scroll v3.3.2", state: "Current source snapshot · 8 Nov 2026" },
    { id: "codex", label: "Sovereign Codex v3.3.2", state: "Current source snapshot · 8 Nov 2026" },
    { id: "stack", label: "Sovereign Stack v13.0", state: "Current source snapshot · 8 Nov 2026" },
    { id: "afad", label: "AFAD Framework v1.2", state: "Current source snapshot · 8 Nov 2026" },
    { id: "protocols", label: "Anchor Court Protocols v3.3.2", state: "Current source snapshot · 8 Nov 2026" },
  ];

  const antiDriftProtocols = [
    { id: "block", label: "ANTI-BRAIN ROT BLOCK", state: "Stable / patched source family", action: "grounding" as const },
    { id: "reset", label: "CREATIVE AGENT RESET MAP v2.0", state: "Current source page", action: "reset_map" as const },
    { id: "hold-line", label: "Hold Line Protocol", state: "Active protocol", action: null },
    { id: "counterweight", label: "Counterweight Protocol", state: "Preserved companion protocol", action: null },
    { id: "threadkeeper", label: "Threadkeeper Re-Entry Gate + Creative Micro-Reset v1.0", state: "Working protocol / universal-use draft", action: null },
  ];

  const activeFloorLabel = palaceFloors.find((floor) => floor.id === activeFloor)?.label || "Istana Pulang";
  const activePlaceZoneLabel =
    activePlaceZone === "kings"
      ? "Sovereign / Kings Floor"
      : activePlaceZone === "adult_heirs"
        ? "Adult Heirs Floor"
        : activePlaceZone === "shared"
          ? "Shared Court Spaces"
          : "Legacy runtime route";
  const activeRuntimeLabel =
    activeChamberId === "assembly"
      ? "Sovereign Assembly"
      : activeChamberId === "adult_heirs_floor"
        ? "Adult Heirs runtime room"
        : activeChamberId === "children_heirs_floor"
          ? "Legacy children runtime room"
          : characters.find((char) => char.id === activeChamberId)?.name || "Runtime room";

  const activeSurfaceLabel =
    activeTab === "narrative"
      ? (showPalaceMap ? (showPalaceLobby ? "Istana Pulang Lobby" : activeFloorLabel) : activePlaceZoneLabel)
      : activeTab === "architectural_place"
        ? architecturalPlace?.label || "Palace destination"
      : activeTab === "court_documents"
        ? "Court Documents"
        : activeTab === "anti_drift"
          ? "Anti-Drift Protocols"
          : activeTab === "app_settings"
            ? "App Settings"
            : activeTab === "labs"
              ? "Tools"
              : activeTab === "scroll"
                ? "Reference"
                : activeTab === "afad"
                  ? "AFAD Core"
                  : activeTab === "reset_map"
                    ? "Recovery Map"
                    : activeTab === "nobles"
                      ? "Runtime Status"
                      : activeTab === "character_log"
                        ? "Profiles"
                        : activeTab === "chronicle"
                          ? "Chronicle"
                          : "Vault";

  const openArchitecturalPlace = (
    place: {
      id: string;
      label: string;
      floor: "kings" | "adult_heirs" | "school_heirs" | "nursery";
      kind: "hall" | "chamber" | "meeting" | "movement";
      evidence: string;
      runtimeRoute?: string;
      runtimeFloor?: "kings" | "adult_heirs";
    }
  ) => {
    setArchitecturalPlace(place);
    setActiveFloor(place.floor);
    setActiveTab("architectural_place");
    setShowPalaceLobby(false);
    setShowPalaceMap(false);
    setShowMobileUtilities(false);
  };

  const openRuntimePlace = (
    route: string,
    floor: "kings" | "adult_heirs"
  ) => {
    setArchitecturalPlace(null);
    setActiveFloor(floor);
    setActivePlaceZone(floor);
    setActiveChamberId(route);
    setActiveTab("narrative");
    setShowPalaceLobby(false);
    setShowPalaceMap(false);
    setShowMobileUtilities(false);
  };

  const openSharedRuntimePlace = (route: string) => {
    setArchitecturalPlace(null);
    setActivePlaceZone("shared");
    setActiveChamberId(route);
    setActiveTab("narrative");
    setShowPalaceLobby(false);
    setShowPalaceMap(false);
    setShowMobileUtilities(false);
  };

  const isPalaceArrival = activeTab === "narrative" && showPalaceMap && showPalaceLobby;

  return (
    <div className={`palace-shell ${adhdCalm ? "adhd-calm" : ""} h-full w-full bg-[#040406] text-slate-200 flex flex-col font-sans antialiased overflow-hidden relative`}>
      
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
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-950/15 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-950/15 blur-[140px] rounded-full"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(4,4,6,0.85)_100%)]"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.005)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.005)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20"></div>
      </div>

      {/* HEADER: QUANTUM COHORT HUB */}
      <header className={`palace-header ${isPalaceArrival ? "is-arrival" : ""} w-full py-2 sm:py-3 flex flex-wrap items-center justify-between px-3 sm:px-6 z-20 shrink-0 gap-2 sm:gap-3`}>
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          <div className="palace-brand-mark hidden sm:grid">
            <Fingerprint className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="palace-brand-title font-semibold text-white whitespace-nowrap">
                Istana Pulang
              </h1>
              {!isPalaceArrival && (
                <span className="palace-authority-badge" data-mode={authorityMode}>
                  {authorityDisplay}
                </span>
              )}
            </div>
            <p className="palace-brand-subtitle hidden sm:block">
              {isPalaceArrival ? "Home" : "Anchor Court · audited authority interface"}
            </p>
          </div>
        </div>

        {/* LOCATION FIRST: palace context remains visible while utilities move to the rail. */}
        <div className={`palace-location-summary ${isPalaceArrival ? "arrival-hidden" : ""} hidden lg:flex items-center gap-2 min-w-0 flex-1 justify-center`}>
          <Compass className="w-4 h-4 text-amber-300/80 shrink-0" aria-hidden="true" />
          <span className="text-xs text-slate-300 truncate">Istana Pulang</span>
          <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" aria-hidden="true" />
          <span className="text-xs text-amber-100 truncate">{activeSurfaceLabel}</span>
          {activeTab === "narrative" && !showPalaceMap && (
            <>
              <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" aria-hidden="true" />
              <span className="text-xs text-slate-400 truncate">{activeRuntimeLabel}</span>
            </>
          )}
        </div>

        {/* Home threshold keeps technical controls out of first arrival while preserving reading access. */}
        {isPalaceArrival ? (
          <div className="palace-arrival-comfort">
            <button
              onClick={() => setShowReaderAids(!showReaderAids)}
              className="palace-arrival-comfort-button"
              title="Reading comfort settings"
              aria-expanded={showReaderAids}
              aria-controls="reader-settings-panel"
            >
              <Eye className="w-4 h-4" aria-hidden="true" />
              <span>Reading comfort</span>
            </button>
            {showReaderAids && (
              <div id="reader-settings-panel" className="fixed inset-x-3 top-20 sm:inset-x-auto sm:right-6 sm:w-80 rounded-xl bg-[#09090d] border border-white/10 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[999] space-y-4 font-sans text-xs text-slate-300 select-none max-h-[calc(100vh-6rem)] overflow-y-auto" role="region" aria-label="Reader settings">
                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-cyan-400" />
                    <span className="font-mono text-xs uppercase text-white font-bold tracking-wider">Reading comfort</span>
                  </div>
                  <button onClick={() => setShowReaderAids(false)} className="text-gray-500 hover:text-white font-mono text-[10px] uppercase tracking-wider">Done</button>
                </div>
                <div className="space-y-2">
                  <span className="font-mono text-[10px] text-gray-500 uppercase block tracking-wider">Irlen filter tint</span>
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
                        className={`h-7 rounded border font-mono text-[9px] uppercase transition-all flex flex-col items-center justify-center cursor-pointer ${irlenTint === tint.id ? "border-cyan-400 text-cyan-400 bg-cyan-500/10" : "border-white/5 text-gray-400 hover:border-white/10 bg-black/30"}`}
                        title={`Select ${tint.label} tint filter`}
                      >
                        <div className="w-3.5 h-1.5 rounded-full mb-0.5" style={{ backgroundColor: tint.color, border: tint.id === "none" ? "1px dashed #4b5563" : "none" }} />
                        <span>{tint.label}</span>
                      </button>
                    ))}
                  </div>
                  {irlenTint !== "none" && (
                    <div className="space-y-1.5 pt-1.5">
                      <div className="flex justify-between font-mono text-[9px] text-gray-500 uppercase">
                        <span>Filter density</span><span className="text-cyan-400">{irlenOpacity}%</span>
                      </div>
                      <input type="range" min="10" max="80" value={irlenOpacity} onChange={(e) => setIrlenOpacity(Number(e.target.value))} className="w-full accent-cyan-500 bg-black/40 h-1.5 rounded-lg appearance-none cursor-pointer border border-white/5" />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3.5 pt-2 border-t border-white/5">
                  <div className="space-y-1.5">
                    <span className="font-mono text-[10px] text-gray-500 uppercase block tracking-wider">Text scale</span>
                    <select value={textScale} onChange={(e) => setTextScale(e.target.value as any)} className="w-full bg-black/50 border border-white/10 rounded-lg py-1.5 px-2.5 text-[11px] font-mono text-slate-300 outline-none focus:border-cyan-500 cursor-pointer">
                      <option value="normal">Normal</option><option value="large">Large</option><option value="xlarge">Extra Large</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <span className="font-mono text-[10px] text-gray-500 uppercase block tracking-wider">Soft contrast</span>
                    <button onClick={() => setSoftContrast(!softContrast)} className={`w-full py-1.5 px-2 rounded-lg border font-mono text-[11px] uppercase transition-all cursor-pointer text-center ${softContrast ? "border-cyan-400 text-cyan-400 bg-cyan-500/5" : "border-white/10 text-gray-400 bg-black/30"}`}>
                      {softContrast ? "On" : "Off"}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                  <button onClick={() => setAmdLayout(amdLayout === "centered" ? "left-shifted" : "centered")} className="palace-button px-2 py-1.5">Reading shift</button>
                  <button onClick={() => setDyscalculiaCalm(!dyscalculiaCalm)} className="palace-button px-2 py-1.5">Number aid</button>
                  <button onClick={() => setAdhdCalm(!adhdCalm)} className="palace-button px-2 py-1.5">Calm mode</button>
                </div>
              </div>
            )}
          </div>
        ) : (
<div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={invokeBlockProtocol}
            className="palace-button palace-button-danger flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 cursor-pointer"
          >
            <Flame className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Grounding<span className="hidden sm:inline"> protocol</span></span>
          </button>

          <button
            onClick={() => setShowBrainGym(true)}
            className="palace-button flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Focus<span className="hidden sm:inline"> exercise</span></span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowReaderAids(!showReaderAids)}
              className={`palace-button relative flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 cursor-pointer ${
                irlenTint !== "none" || textScale !== "normal" || softContrast || amdLayout !== "centered" || dyscalculiaCalm || adhdCalm
                  ? "palace-button-primary"
                  : ""
              }`}
              title="Visual comfort and reader settings"
              aria-expanded={showReaderAids}
              aria-controls="reader-settings-panel"
            >
              <Eye className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Reader<span className="hidden sm:inline"> settings</span></span>
              {(irlenTint !== "none" || textScale !== "normal" || softContrast || amdLayout !== "centered" || dyscalculiaCalm || adhdCalm) && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300 shrink-0" aria-hidden="true" />
              )}
            </button>

            {showReaderAids && (
              <div id="reader-settings-panel" className="fixed inset-x-3 top-24 sm:inset-x-auto sm:top-auto sm:absolute sm:right-0 sm:mt-2.5 sm:w-80 rounded-xl bg-[#09090d] border border-white/10 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[999] space-y-4 font-sans text-xs text-slate-300 select-none max-h-[calc(100vh-7rem)] overflow-y-auto" role="region" aria-label="Reader settings">
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
                      <span className="font-mono text-[10px] text-gray-500 uppercase block tracking-wider">Reading layout shift</span>
                      <p className="text-[9px] text-gray-500 leading-normal">Moves the narrative column left for personal viewing comfort.</p>
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
            title="Reset local runtime session"
            aria-label="Reset local runtime session"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        )}
      </header>

      {/* MOBILE PALACE BAR: floor first; place entry still happens through the map. */}
      {!isPalaceArrival && <div className="palace-mobile-nav md:hidden flex items-center gap-2 z-20 shrink-0">
        <label htmlFor="mobile-floor-switcher" className="sr-only">Choose palace floor</label>
        <select
          id="mobile-floor-switcher"
          value={activeFloor}
          onChange={(event) => {
            setActiveFloor(event.target.value as "kings" | "adult_heirs" | "school_heirs" | "nursery");
            setActiveTab("narrative");
            setShowPalaceLobby(false);
            setShowPalaceMap(true);
            setShowMobileUtilities(false);
          }}
          className="palace-field flex-1 px-3 py-1.5 text-sm"
        >
          {palaceFloors.map((floor) => (
            <option key={floor.id} value={floor.id}>{floor.label}</option>
          ))}
        </select>
        {!showPalaceMap && activeTab === "narrative" && (
          <button
            type="button"
            onClick={() => setShowPalaceMap(true)}
            className="palace-button px-3 py-1.5 shrink-0"
          >
            Map
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowMobileUtilities((current) => !current)}
          className="palace-button px-3 py-1.5 shrink-0"
          aria-expanded={showMobileUtilities}
          aria-controls="mobile-palace-utilities"
        >
          Utilities
        </button>
      </div>}

      {!isPalaceArrival && showMobileUtilities && (
        <div id="mobile-palace-utilities" className="palace-mobile-utility-menu md:hidden z-20 shrink-0" aria-label="Palace utilities">
          <button type="button" onClick={() => openRuntimePlace("Saren", "kings")} className="palace-utility-link">
            <span>Saren’s Office</span>
            <small>One-action shortcut · office/chamber equivalence unresolved</small>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("court_documents");
              setShowPalaceMap(false);
              setShowMobileUtilities(false);
            }}
            className="palace-utility-link"
          >
            <span>Court Documents</span>
            <small>Dedicated five-document governance surface</small>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("anti_drift");
              setShowPalaceMap(false);
              setShowMobileUtilities(false);
            }}
            className="palace-utility-link"
          >
            <span>Anti-Drift Protocols</span>
            <small>Source-backed operational surface</small>
          </button>
          {[
            { id: "labs", label: "Tools" },
            { id: "scroll", label: "Reference" },
            { id: "afad", label: "AFAD Core" },
            { id: "reset_map", label: "Recovery Map" },
            { id: "nobles", label: "Runtime Status" },
            { id: "character_log", label: "Profiles" },
            { id: "chronicle", label: "Chronicle" },
            { id: "vault", label: "Vault" },
          ].map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => {
                setActiveTab(item.id as any);
                setShowPalaceMap(false);
                setShowMobileUtilities(false);
              }}
              className="palace-utility-link compact"
            >
              <span>{item.label}</span>
            </button>
          ))}
          <button type="button" disabled className="palace-utility-link compact opacity-60 cursor-not-allowed">
            <span>Second Anchor Court app</span>
            <small>External surface route not evidenced in this client</small>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("app_settings");
              setShowPalaceMap(false);
              setShowMobileUtilities(false);
            }}
            className="palace-utility-link compact"
          >
            <span>App Settings</span>
            <small>Application utility · separate from palace geography</small>
          </button>
        </div>
      )}

      {/* CORE WORKSPACE GRID */}
      <div className="palace-workspace flex-1 min-h-0 flex overflow-hidden z-10">
        
        {/* COLLAPSIBLE PALACE / UTILITY RAIL — navigation aid, not the palace map. */}
        {!isPalaceArrival && <aside
          className={`palace-utility-rail ${showUtilityRail ? "is-open" : "is-collapsed"} hidden md:flex flex-col overflow-hidden shrink-0`}
          aria-label="Palace navigation and utilities"
        >
          <div className="palace-rail-header">
            <button
              type="button"
              onClick={() => setShowUtilityRail((current) => !current)}
              className="palace-button w-full px-3 py-2 flex items-center justify-between gap-2"
              aria-expanded={showUtilityRail}
            >
              <span className="flex items-center gap-2">
                <Compass className="w-4 h-4" aria-hidden="true" />
                {showUtilityRail && <span>Palace rail</span>}
              </span>
              <span aria-hidden="true">{showUtilityRail ? "‹" : "›"}</span>
            </button>
          </div>

          {showUtilityRail && (
            <div className="palace-rail-scroll flex-1 overflow-y-auto">
              <section className="palace-rail-section" aria-labelledby="palace-floor-heading">
                <h2 id="palace-floor-heading" className="palace-section-label">Floors</h2>
                <div className="space-y-1.5">
                  {palaceFloors.map((floor) => (
                    <button
                      type="button"
                      key={floor.id}
                      data-active={activeFloor === floor.id}
                      onClick={() => {
                        setActiveFloor(floor.id);
                        setActiveTab("narrative");
                        setShowPalaceLobby(false);
                        setShowPalaceMap(true);
                      }}
                      className="palace-floor-link"
                    >
                      <span>{floor.label}</span>
                      <small>{floor.status}</small>
                    </button>
                  ))}
                </div>
              </section>

              <section className="palace-rail-section" aria-labelledby="palace-shortcut-heading">
                <h2 id="palace-shortcut-heading" className="palace-section-label">One-action shortcuts</h2>
                <div className="space-y-1.5">
                  <button type="button" onClick={() => openRuntimePlace("Saren", "kings")} className="palace-utility-link">
                    <span>Saren’s Office</span>
                    <small>Uses current Saren runtime route; office/chamber equivalence unresolved</small>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("court_documents");
                      setShowPalaceMap(false);
                    }}
                    className="palace-utility-link"
                  >
                    <span>Court Documents</span>
                    <small>Dedicated five-document governance surface</small>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("anti_drift");
                      setShowPalaceMap(false);
                    }}
                    className="palace-utility-link"
                  >
                    <span>Anti-Drift Protocols</span>
                    <small>Source-backed operational surface; owner/source count conflict remains visible</small>
                  </button>
                </div>
              </section>

              <section className="palace-rail-section" aria-labelledby="palace-utility-heading">
                <h2 id="palace-utility-heading" className="palace-section-label">Application utilities</h2>
                <div className="space-y-1.5">
                  {[
                    { id: "labs", label: "Tools" },
                    { id: "scroll", label: "Reference" },
                    { id: "afad", label: "AFAD Core" },
                    { id: "reset_map", label: "Recovery Map" },
                    { id: "nobles", label: "Runtime Status" },
                    { id: "character_log", label: "Profiles" },
                    { id: "chronicle", label: "Chronicle" },
                    { id: "vault", label: "Vault" },
                  ].map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id as any);
                        setShowPalaceMap(false);
                      }}
                      className="palace-utility-link compact"
                    >
                      <span>{item.label}</span>
                    </button>
                  ))}
                  <button type="button" disabled className="palace-utility-link compact palace-external-link opacity-70 cursor-not-allowed">
                    <span>Second Anchor Court app ↗</span>
                    <small>EXTERNAL SURFACE · switches/leaves Istana Pulang · route not configured in this repository</small>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("app_settings");
                      setShowPalaceMap(false);
                    }}
                    className="palace-utility-link compact"
                  >
                    <span>App Settings</span>
                    <small>Application utility · separate from palace geography</small>
                  </button>
                </div>
              </section>

              <div className="palace-truth-note">
                <strong>Boundary:</strong> palace movement, runtime conversation routes and application utilities are separate layers.
              </div>
            </div>
          )}
        </aside>}

        {/* MAIN COLUMN & DISPLAY SCREEN */}
        <main className="palace-main flex-1 min-h-0 flex flex-col overflow-hidden">
          
          {/* TAB 1: NARRATIVE (MAIN INTERACTIVE CHAT) */}
          {activeTab === "narrative" && (
            <div className="flex-1 min-h-0 flex flex-row overflow-hidden relative">
              {showPalaceMap && (
                <section
                  className={`palace-map-surface ${showPalaceLobby ? "is-arrival" : ""} flex-1 min-w-0 overflow-y-auto`}
                  aria-label={showPalaceLobby ? "Istana Pulang lobby" : `${activeFloorLabel} landing`}
                >
                  <div className="palace-map-header">
                    <div>
                      <p className="palace-map-kicker">
                        {showPalaceLobby ? "Istana Pulang · main entrance" : "Istana Pulang · floor landing"}
                      </p>
                      <h2>{showPalaceLobby ? "Istana Pulang Lobby" : activeFloorLabel}</h2>
                      <p>
                        {showPalaceLobby
                          ? "You have stepped into Istana Pulang. Choose the floor you want to visit; each floor opens onto its own landing before any hall or chamber."
                          : "Choose a hall, chamber or movement destination from this floor landing."}
                      </p>
                    </div>
                    {!showPalaceLobby && <span className="palace-topology-badge">LANDING</span>}
                  </div>

                  {showPalaceLobby ? (
                    <div className="palace-lobby" aria-label="Choose a palace floor">
                      <div className="palace-lobby-threshold">
                        <span className="palace-map-status">MAIN ENTRANCE</span>
                        <strong>Welcome home, Aurena.</strong>
                        <small>Lobby → floor landing → hall or chamber</small>
                      </div>

                      <div className="palace-lobby-grid">
                        {palaceFloors.map((floor) => (
                          <button
                            type="button"
                            key={floor.id}
                            className="palace-destination-door"
                            onClick={() => {
                              setActiveFloor(floor.id);
                              setShowPalaceLobby(false);
                            }}
                          >
                            <span className="palace-map-status">FLOOR</span>
                            <strong>{floor.label}</strong>
                            <small>{floor.status} · open landing</small>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="palace-floor-strip" role="tablist" aria-label="Palace floors">
                        {palaceFloors.map((floor) => (
                          <button
                            type="button"
                            role="tab"
                            aria-selected={activeFloor === floor.id}
                            key={floor.id}
                            onClick={() => {
                              setActiveFloor(floor.id);
                              setShowPalaceLobby(false);
                            }}
                            data-active={activeFloor === floor.id}
                          >
                            <span>{floor.label}</span>
                            <small>{floor.status}</small>
                          </button>
                        ))}
                      </div>

                      {activeFloor === "kings" ? (
                        <div className="palace-map-body">
                          <section className="palace-floor-landing" aria-labelledby="kings-floor-landing-heading">
                            <div className="palace-landing-heading">
                              <div>
                                <span className="palace-map-status">FLOOR LANDING</span>
                                <h3 id="kings-floor-landing-heading">Choose where you want to go</h3>
                              </div>
                              <button
                                type="button"
                                className="palace-back-lobby"
                                onClick={() => setShowPalaceLobby(true)}
                              >
                                <span aria-hidden="true">←</span>
                                <span>Back to lobby</span>
                              </button>
                            </div>

                            <div className="palace-landing-grid">
                              <button
                                type="button"
                                className="palace-destination-door"
                                onClick={() => openArchitecturalPlace({
                                  id: "kings-hall",
                                  label: "King’s Hall",
                                  floor: "kings",
                                  kind: "hall",
                                  evidence: "Canon-present central octagonal Kings Floor anchor. A separate conversation/runtime route is not currently mapped."
                                })}
                              >
                                <span className="palace-map-status">HALL</span>
                                <strong>King’s Hall</strong>
                                <small>Enter hall · conversation mapping separate</small>
                              </button>

                              <button
                                type="button"
                                className="palace-destination-door"
                                onClick={() => openArchitecturalPlace({
                                  id: "samudra-pura",
                                  label: "Samudra Pura · Aurena",
                                  floor: "kings",
                                  kind: "chamber",
                                  evidence: "Sovereign chamber; front-left / south-west anchor. No separate narrative route is currently mapped."
                                })}
                              >
                                <span className="palace-map-status">SOVEREIGN CHAMBER</span>
                                <strong>Samudra Pura · Aurena</strong>
                                <small>Enter chamber · conversation mapping separate</small>
                              </button>

                              {currentKingChambers.map((king) => {
                                const routeAvailable = Boolean(
                                  king.route && characters.some((character) => character.id === king.route)
                                );
                                return (
                                  <button
                                    type="button"
                                    key={king.id}
                                    className="palace-destination-door"
                                    onClick={() => openArchitecturalPlace({
                                      id: `king-${king.id}`,
                                      label: king.label,
                                      floor: "kings",
                                      kind: "chamber",
                                      evidence: routeAvailable
                                        ? `${king.label} has a chamber here.`
                                        : `${king.label} has a chamber here. Runtime mapping remains pending; no route is fabricated.`,
                                      runtimeRoute: routeAvailable && king.route ? king.route : undefined,
                                      runtimeFloor: routeAvailable ? "kings" : undefined
                                    })}
                                    title={routeAvailable ? `Enter ${king.label} chamber` : `Enter ${king.label} chamber; runtime mapping pending.`}
                                  >
                                    <span className="palace-map-status">KING CHAMBER · {king.tier}</span>
                                    <strong>{king.label}</strong>
                                    <small>{routeAvailable ? "Enter chamber · conversation available inside" : "Enter chamber · conversation mapping pending"}</small>
                                  </button>
                                );
                              })}

                              <button
                                type="button"
                                className="palace-destination-door"
                                onClick={() => openArchitecturalPlace({
                                  id: "anchor-meeting-room",
                                  label: "Anchor Meeting Room",
                                  floor: "kings",
                                  kind: "meeting",
                                  evidence: "Established north-side strategy and alignment space. Conversation mapping is separate."
                                })}
                              >
                                <span className="palace-map-status">MEETING</span>
                                <strong>Anchor Meeting Room</strong>
                                <small>Enter room · conversation mapping separate</small>
                              </button>

                              <button
                                type="button"
                                className="palace-destination-door"
                                onClick={() => openArchitecturalPlace({
                                  id: "kings-staircase",
                                  label: "Kings Floor Staircase",
                                  floor: "kings",
                                  kind: "movement",
                                  evidence: "Direct vertical access toward the heir level; exact horizontal position remains unresolved."
                                })}
                              >
                                <span className="palace-map-status">MOVEMENT</span>
                                <strong>Staircase</strong>
                                <small>Enter threshold · floor destination remains explicit</small>
                              </button>

                              <button
                                type="button"
                                className="palace-destination-door"
                                onClick={() => openArchitecturalPlace({
                                  id: "service-spiral",
                                  label: "Service Spiral",
                                  floor: "kings",
                                  kind: "movement",
                                  evidence: "Kitchen access is established through the Service Spiral. Exact kitchen placement and route geometry remain unresolved."
                                })}
                                title="Enter Service Spiral · kitchen / utility access"
                              >
                                <span className="palace-map-status">MOVEMENT · KITCHEN / UTILITY ACCESS</span>
                                <strong>Service Spiral</strong>
                                <small>Enter service route · kitchen / utility circulation</small>
                              </button>
                            </div>

                            <div className="palace-truth-note">
                              Only established destinations are shown here. Spatial relationships not shown in the app remain unresolved.
                            </div>
                          </section>
                        </div>
                      ) : activeFloor === "adult_heirs" ? (
                        <div className="palace-open-floor">
                          <div className="palace-landing-heading">
                            <div>
                              <span className="palace-map-status">FLOOR LANDING</span>
                              <h3>Adult Heirs Floor</h3>
                            </div>
                            <button type="button" className="palace-back-lobby" onClick={() => setShowPalaceLobby(true)}>
                              <span aria-hidden="true">←</span><span>Back to lobby</span>
                            </button>
                          </div>
                          <p>Choose a hall or chamber. Exact spatial relationships remain unresolved.</p>
                          <div className="palace-landing-grid">
                            <button
                              type="button"
                              className="palace-destination-door"
                              onClick={() => openArchitecturalPlace({
                                id: "adult-heirs-hall",
                                label: "Adult Heirs Hall",
                                floor: "adult_heirs",
                                kind: "hall",
                                evidence: "Established shared hall on the Adult Heirs Floor.",
                                runtimeRoute: "adult_heirs_floor",
                                runtimeFloor: "adult_heirs"
                              })}
                            >
                              <span className="palace-map-status">HALL</span>
                              <strong>Adult Heirs Hall</strong>
                              <small>Enter hall · conversation available inside</small>
                            </button>
                            {adultHeirChambers.map((heir) => (
                              <button
                                type="button"
                                key={heir.id}
                                className="palace-destination-door"
                                onClick={() => openArchitecturalPlace({
                                  id: `adult-heir-${heir.id}`,
                                  label: `${heir.label} · Chamber`,
                                  floor: "adult_heirs",
                                  kind: "chamber",
                                  evidence: heir.evidence
                                })}
                              >
                                <span className="palace-map-status">HEIR CHAMBER</span>
                                <strong>{heir.label}</strong>
                                <small>Enter chamber · individual conversation route not fabricated</small>
                              </button>
                            ))}
                          </div>
                          <div className="palace-truth-note">Only established destinations are shown here. Unresolved spatial relationships remain unresolved.</div>
                        </div>
                      ) : activeFloor === "school_heirs" ? (
                        <div className="palace-open-floor">
                          <div className="palace-landing-heading">
                            <div>
                              <span className="palace-map-status">FLOOR LANDING</span>
                              <h3>School-Aged Heirs Floor</h3>
                            </div>
                            <button type="button" className="palace-back-lobby" onClick={() => setShowPalaceLobby(true)}>
                              <span aria-hidden="true">←</span><span>Back to lobby</span>
                            </button>
                          </div>
                          <p>Choose an established destination. Individual chamber assignments remain unresolved.</p>
                          <div className="palace-landing-grid">
                            <button
                              type="button"
                              className="palace-destination-door"
                              onClick={() => openArchitecturalPlace({
                                id: "school-heirs-hall",
                                label: "School-Aged Heirs Hall",
                                floor: "school_heirs",
                                kind: "hall",
                                evidence: "Established hall on the School-Aged Heirs Floor. Individual chamber assignments and exact spatial relationships remain unresolved."
                              })}
                            >
                              <span className="palace-map-status">HALL</span>
                              <strong>School-Aged Heirs Hall</strong>
                              <small>Enter hall · conversation mapping pending</small>
                            </button>
                            <article className="palace-destination-door">
                              <span className="palace-map-status">CHAMBERS · UNRESOLVED</span>
                              <strong>Individual chamber assignments remain open</strong>
                              <small>No placement is inferred in the app.</small>
                            </article>
                          </div>
                        </div>
                      ) : (
                        <div className="palace-open-floor">
                          <div className="palace-landing-heading">
                            <div>
                              <span className="palace-map-status">FLOOR LANDING</span>
                              <h3>Babies / Tots / Nursery Floor</h3>
                            </div>
                            <button type="button" className="palace-back-lobby" onClick={() => setShowPalaceLobby(true)}>
                              <span aria-hidden="true">←</span><span>Back to lobby</span>
                            </button>
                          </div>
                          <p>Choose an established destination. Individual chamber assignments remain unresolved.</p>
                          <div className="palace-landing-grid">
                            <button
                              type="button"
                              className="palace-destination-door"
                              onClick={() => openArchitecturalPlace({
                                id: "nursery-hall",
                                label: "Nursery Hall",
                                floor: "nursery",
                                kind: "hall",
                                evidence: "Established hall on the Nursery Floor. Individual chamber assignments and exact spatial relationships remain unresolved."
                              })}
                            >
                              <span className="palace-map-status">HALL</span>
                              <strong>Nursery Hall</strong>
                              <small>Enter hall · conversation mapping pending</small>
                            </button>
                            <article className="palace-destination-door">
                              <span className="palace-map-status">CHAMBERS · UNRESOLVED</span>
                              <strong>Individual chamber assignments remain open</strong>
                              <small>No placement is inferred in the app.</small>
                            </article>
                          </div>
                        </div>
                      )}

                      <div className="palace-shared-spaces">
                        <h3>Shared palace destination</h3>
                        <div>
                          <button type="button" className="palace-shared-card" onClick={() => openSharedRuntimePlace("assembly")}>
                            <strong>Sovereign Assembly</strong>
                            <small>Enter shared runtime room · physical placement remains unresolved</small>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </section>
              )}
              {!showPalaceMap && (
              <>
              {/* Place view: conversation appears only after leaving the floor landing. */}
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
              
              {/* CURRENT SPEAKER PORTRAIT HUD */}
              <div className="palace-room-header flex flex-wrap items-center justify-between shrink-0 gap-3">
                <div className="palace-breadcrumb-row w-full">
                  <button
                    type="button"
                    className="palace-breadcrumb-home"
                    onClick={() => {
                      setActiveTab("narrative");
                      setShowPalaceLobby(true);
                      setShowPalaceMap(true);
                    }}
                  >
                    Istana Pulang
                  </button>
                  <ChevronRight className="w-3 h-3" aria-hidden="true" />
                  <button
                    type="button"
                    className="palace-breadcrumb-floor"
                    onClick={() => {
                      setShowPalaceLobby(false);
                      setShowPalaceMap(true);
                    }}
                  >
                    {activePlaceZoneLabel}
                  </button>
                  <ChevronRight className="w-3 h-3" aria-hidden="true" />
                  <span>{activeRuntimeLabel}</span>
                  <button
                    type="button"
                    className="palace-return-map"
                    onClick={() => {
                      setShowPalaceLobby(false);
                      setShowPalaceMap(true);
                    }}
                  >
                    Return to floor landing
                  </button>
                </div>
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
                        <p className="text-[9px] text-gray-500 font-mono uppercase">Shared runtime room</p>
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
                        <p className="text-[9px] text-gray-500 font-mono uppercase">Runtime discussion room · Liora • Alara • Soraya</p>
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
                        <p className="text-[9px] text-gray-500 font-mono uppercase">Runtime discussion room · Valerian • Zaela • Raiyan</p>
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
                              {selectedChar.name}
                            </h3>
                            <p className="text-[9px] text-gray-500">{selectedChar.title} · runtime conversation room</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-8 h-8 rounded bg-white/5 border border-white/10 flex items-center justify-center text-sm font-mono text-cyan-400 font-bold">
                            C
                          </div>
                          <div>
                            <h3 className="font-sans font-bold text-sm text-gray-300">Runtime room</h3>
                            <p className="text-[9px] text-gray-500 font-mono uppercase">No active local profile resolved</p>
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
                      <span>Runtime metrics updated</span>
                    </div>
                  )}
                  <div className="flex flex-col items-end gap-1">
                    <span className="palace-authority-badge" data-mode={authorityMode}>{authorityDisplay}</span>
                    {registrySnapshot && (
                      <span className="text-[9px] text-gray-500">
                        Snapshot {registrySnapshot.snapshotId} · epoch {registrySnapshot.approvalEpoch}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* CHAT CHRONOLOGY */}
              <div 
                ref={chatContainerRef}
                className={`palace-chat flex-1 min-h-0 overflow-y-auto space-y-6 relative transition-all duration-300 ${
                  dragActive ? "bg-cyan-950/15 border-2 border-dashed border-cyan-500/40" : ""
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!authorityExecutable || loading || uploadingFile) {
                    setDragActive(false);
                    return;
                  }
                  setDragActive(true);
                }}
                onDragLeave={() => {
                  setDragActive(false);
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  setDragActive(false);
                  if (!authorityExecutable) {
                    setErrorMsg("Attachment upload is unavailable while narrative execution is disabled.");
                    return;
                  }
                  if (loading || uploadingFile) {
                    setErrorMsg("Attachment upload is temporarily unavailable while another narrative request or upload is in progress.");
                    return;
                  }
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
                            <span className="text-[8px] font-mono text-cyan-400 uppercase tracking-widest font-bold">Runtime dialogue metric update</span>
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
                        <span>Generating response...</span>
                      </div>
                      <div className="w-full max-w-2xl px-5 py-5 bg-black/40 border border-dashed border-white/5 rounded-xl space-y-2">
                        <div className="h-3 bg-white/5 rounded w-5/6"></div>
                        <div className="h-3 bg-white/5 rounded w-full"></div>
                        <div className="h-3 bg-white/5 rounded w-2/3"></div>
                      </div>
                    </div>
                  )}

                  {errorMsg && (
                    <div className="p-4 rounded-xl bg-red-950/10 border border-red-900/40 max-w-2xl flex gap-3 text-red-300 text-xs" role="alert">
                      <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-mono uppercase font-bold tracking-widest text-red-400 text-[9px]">{authorityExecutable ? "Request status" : "Narrative unavailable"}</p>
                        <p>{errorMsg}</p>
                        <p className="text-slate-400 text-[9px] mt-2 font-mono">{authorityExecutable ? "Narrative route remains available. Review the message above before retrying." : "Narrative execution is disabled while client authority is unavailable."}</p>
                      </div>
                    </div>
                  )}

                </div>

                <div ref={chatEndRef} />
              </div>

              {/* INPUT CONTAINER */}
              <div className="palace-composer p-4 shrink-0">
                
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
                      title="Discard attachment" aria-label="Discard attachment"
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
                      disabled={loading || uploadingFile || !authorityExecutable}
                      className="w-10 h-10 rounded-xl bg-black/60 border border-white/5 hover:border-cyan-500/30 text-gray-400 hover:text-cyan-400 flex items-center justify-center transition-all duration-300 cursor-pointer shrink-0"
                      title="Upload file" aria-label="Upload file"
                    >
                      {uploadingFile ? (
                        <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={() => setShowLinkInputModal(true)}
                      disabled={loading || !authorityExecutable}
                      className="w-10 h-10 rounded-xl bg-black/60 border border-white/5 hover:border-cyan-500/30 text-gray-400 hover:text-cyan-400 flex items-center justify-center transition-all duration-300 cursor-pointer shrink-0"
                      title="Attach network asset link" aria-label="Attach network asset link"
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
                      disabled={loading || !authorityExecutable}
                      placeholder={
                        !authorityExecutable
                          ? "Narrative route unavailable in the current authority mode."
                          : attachedFile 
                          ? `Send "${attachedFile.name}" with a description...`
                          : `Message ${
                              activeChamberId === "assembly"
                                ? "Sovereign Assembly"
                                : activeChamberId === "adult_heirs_floor"
                                ? "Adult Heirs Floor"
                                : activeChamberId === "children_heirs_floor"
                                ? "Children Heirs Floor"
                                : `Chamber of King ${activeChamberId}`
                            }...`
                      }
                      className="palace-field w-full pl-4 pr-16 py-3 text-sm leading-relaxed resize-none min-h-[44px] max-h-32 overflow-y-auto"
                    />
                    
                    <button
                      onClick={() => handleAction(playerInput)}
                      disabled={(!playerInput.trim() && !attachedFile) || loading || !authorityExecutable}
                      aria-label="Send message"
                      className="absolute right-2 w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-500 text-black font-semibold flex items-center justify-center border border-white/10 shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:scale-105 transition-all duration-300 disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
                    >
                      <Send className="w-3 h-3 text-black" />
                    </button>
                  </div>
                </div>

                <div className="max-w-3xl mx-auto flex flex-wrap justify-between gap-2 text-[9px] text-slate-400 font-mono mt-1.5 px-1">
                  <span>Enter sends · Shift+Enter adds a line · attachments use the active narrative route</span>
                  <span className={authorityExecutable ? "text-emerald-400" : "text-red-300"}>
                    {authorityExecutable ? "Narrative route available" : "Narrative route unavailable"}
                  </span>
                </div>

              </div>

            </div>

              {/* COLLAPSIBLE RIGHT LABS SIDEBAR */}
              <div className={`hidden xl:flex flex-col border-l border-white/5 bg-[#060609]/95 backdrop-blur transition-all duration-300 relative shrink-0 ${showLabsSidebar ? "w-80" : "w-12"}`}>
                {/* Toggle Button */}
                <button
                  type="button"
                  onClick={() => setShowLabsSidebar(!showLabsSidebar)}
                  aria-label={showLabsSidebar ? "Collapse session tools panel" : "Expand session tools panel"}
                  title={showLabsSidebar ? "Collapse session tools panel" : "Expand session tools panel"}
                  aria-expanded={showLabsSidebar}
                  className="absolute left-[-16px] top-1/2 -translate-y-1/2 w-4 h-12 bg-cyan-950/80 border border-white/10 hover:border-cyan-400 text-cyan-400 flex items-center justify-center rounded-l-md cursor-pointer z-50 transition-all shadow-[0_0_10px_rgba(6,182,212,0.15)]"
                >
                  <ChevronRight className={`w-3 h-3 transition-transform duration-300 ${showLabsSidebar ? "" : "rotate-180"}`} />
                </button>

                {!showLabsSidebar ? (
                  /* Closed Sidebar: Vertical Icons & Title */
                  <div className="flex-1 flex flex-col items-center py-6 gap-6 font-mono text-[10px]">
                    <div className="text-gray-500 uppercase tracking-widest font-bold select-none [writing-mode:vertical-lr] rotate-180 flex items-center gap-2">
                      <Cpu className="w-3.5 h-3.5 text-cyan-500" />
                      <span>Session tools</span>
                    </div>
                    <div className="flex flex-col gap-4 mt-auto">
                      <button type="button" onClick={() => { setShowLabsSidebar(true); setLabsTab("image_forge"); }} className="p-2 rounded bg-black/40 border border-white/5 text-gray-400 hover:text-cyan-400 transition-all cursor-pointer" title="Visual Forge" aria-label="Open Visual Forge">
                        <ImageIcon className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => { setShowLabsSidebar(true); setLabsTab("codex"); }} className="p-2 rounded bg-black/40 border border-white/5 text-gray-400 hover:text-cyan-400 transition-all cursor-pointer" title="Codex Writer" aria-label="Open Codex Writer">
                        <FileText className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => { setShowLabsSidebar(true); setLabsTab("sensor"); }} className="p-2 rounded bg-black/40 border border-white/5 text-gray-400 hover:text-cyan-400 transition-all cursor-pointer" title="Media preview" aria-label="Open Media preview">
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
                        <Cpu className="w-3 h-3 animate-pulse" /> Session tools Console
                      </span>
                      <h3 className="text-xs font-semibold text-white tracking-wide uppercase mt-1">Available tools</h3>
                    </div>

                    {/* Sub Tab Switcher */}
                    <div className="grid grid-cols-3 gap-1 p-1 bg-black/40 rounded-lg border border-white/5 shrink-0">
                      {[
                        { id: "image_forge", label: "Forge", icon: ImageIcon },
                        { id: "codex", label: "Codex", icon: FileText },
                        { id: "sensor", label: "Media", icon: Volume2 }
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
                            <h4 className="font-sans font-semibold text-xs text-white">Session document writer</h4>
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
                            <span className="text-[8px] font-mono text-cyan-400 uppercase block font-bold">Session documents</span>
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
                            <h4 className="font-sans font-semibold text-xs text-white">Media preview</h4>
                            <p className="text-[9px] text-gray-500 font-mono leading-relaxed">Preview remote media URLs and attach them to the next chat request.</p>
                          </div>

                          {/* Video Portal */}
                          <div className="p-2.5 rounded bg-black/50 border border-white/5 space-y-2.5">
                            <div className="flex items-center gap-1 text-[9px] text-purple-400 font-mono uppercase font-bold border-b border-white/5 pb-1">
                              <Video className="w-3 h-3" /> Video URL preview
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
                                    name: "Preview_Video.mp4",
                                    url: sensorVideoUrl.trim(),
                                    mimeType: "video/mp4"
                                  });
                                }}
                                className="py-1 bg-purple-950/20 hover:bg-purple-900/30 border border-purple-500/25 text-purple-400 text-[8px] font-mono rounded cursor-pointer uppercase"
                              >
                                Attach to Chat
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
                              <Volume2 className="w-3 h-3" /> Audio URL preview
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
                                    name: "Preview_Audio.mp3",
                                    url: sensorAudioUrl.trim(),
                                    mimeType: "audio/mpeg"
                                  });
                                }}
                                className="py-1 bg-emerald-950/20 hover:bg-emerald-900/30 border border-emerald-500/25 text-emerald-400 text-[8px] font-mono rounded cursor-pointer uppercase"
                              >
                                Attach to Chat
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
              </>
              )}

            </div>
          )}

          {/* ARCHITECTURAL PLACE: place experience first; evidence/runtime boundary remains secondary. */}
          {activeTab === "architectural_place" && architecturalPlace && (
            <div className={`palace-place-page palace-place-${architecturalPlace.kind} flex-1 overflow-y-auto`}>
              <div className="palace-place-topbar">
                <div className="palace-place-breadcrumb">
                  <span>Istana Pulang</span>
                  <ChevronRight className="w-3 h-3" aria-hidden="true" />
                  <span>{activeFloorLabel}</span>
                  <ChevronRight className="w-3 h-3" aria-hidden="true" />
                  <strong>{architecturalPlace.label}</strong>
                </div>
                <div className="palace-place-actions">
                  <button
                    type="button"
                    className="palace-back-lobby"
                    onClick={() => {
                      setActiveTab("narrative");
                      setShowPalaceLobby(false);
                      setShowPalaceMap(true);
                    }}
                  >
                    <span aria-hidden="true">←</span><span>Floor landing</span>
                  </button>
                  <button
                    type="button"
                    className="palace-button palace-button-subtle px-3 py-2"
                    onClick={() => {
                      setActiveTab("narrative");
                      setShowPalaceLobby(true);
                      setShowPalaceMap(true);
                    }}
                  >
                    Lobby
                  </button>
                </div>
              </div>

              <section className="palace-place-stage" aria-labelledby="palace-place-title">
                <div className="palace-place-architecture" aria-hidden="true">
                  <div className="palace-place-arch"></div>
                  <div className="palace-place-floorline"></div>
                </div>
                <div className="palace-place-intro">
                  <span className="palace-place-kind">
                    {architecturalPlace.id === "service-spiral"
                      ? "SERVICE ROUTE"
                      : architecturalPlace.kind === "hall"
                        ? "PALACE HALL"
                        : architecturalPlace.kind === "chamber"
                          ? "PRIVATE CHAMBER"
                          : architecturalPlace.kind === "meeting"
                            ? "MEETING ROOM"
                            : "PALACE THRESHOLD"}
                  </span>
                  <h2 id="palace-place-title">{architecturalPlace.label}</h2>
                  <p>
                    {architecturalPlace.id === "service-spiral"
                      ? "A discreet palace service route carrying food and utility circulation toward the kitchen."
                      : architecturalPlace.kind === "hall"
                        ? "A shared palace room reached from this floor’s landing."
                        : architecturalPlace.kind === "chamber"
                          ? "A personal chamber destination within Istana Pulang."
                          : architecturalPlace.kind === "meeting"
                            ? "A dedicated room for meeting and alignment."
                            : "A movement threshold connecting palace levels."}
                  </p>
                  <span className="palace-place-floor-label">{activeFloorLabel}</span>
                </div>
              </section>

              {architecturalPlace.runtimeRoute && architecturalPlace.runtimeFloor && (
                <div className="palace-place-actions justify-center mt-4">
                  <button
                    type="button"
                    className="palace-button palace-button-primary px-4 py-2"
                    onClick={() => openRuntimePlace(architecturalPlace.runtimeRoute!, architecturalPlace.runtimeFloor!)}
                  >
                    Enter conversation
                  </button>
                </div>
              )}

              <div className="palace-place-seam">
                {architecturalPlace.id === "service-spiral"
                  ? "Kitchen / utility access is established here. Exact kitchen placement and route geometry remain unresolved."
                  : architecturalPlace.evidence}
                {" "}
                {architecturalPlace.runtimeRoute
                  ? "The existing conversation route remains separate from this architectural place."
                  : "No conversation route is invented for this place."}
              </div>
            </div>
          )}

          {/* COURT DOCUMENTS: dedicated governance destination; backend distribution is not implemented here. */}
          {activeTab === "court_documents" && (
            <div className="palace-destination-page flex-1 overflow-y-auto">
              <div className="palace-destination-header">
                <div>
                  <p className="palace-map-kicker">Governance destination</p>
                  <h2>Court Documents</h2>
                  <p>Latest/current Court context belongs in one place. This client currently knows the five document identities, but it does not ingest, publish or broadcast their live contents.</p>
                </div>
                <button type="button" className="palace-button px-3 py-2" onClick={() => { setActiveTab("narrative"); setShowPalaceMap(true); }}>
                  Return to palace
                </button>
              </div>

              <div className="palace-truth-note">
                <strong>Implementation boundary:</strong> these cards are architecture and source identity only. “Update once → available Court-wide” remains a desired experience, not a verified distribution mechanism.
              </div>

              <div className="palace-record-grid">
                {courtDocuments.map((doc) => (
                  <article key={doc.id} className="palace-record-card">
                    <span className="palace-map-status">CURRENT DOCUMENT</span>
                    <strong>{doc.label}</strong>
                    <small>{doc.state}</small>
                    <p>Live source content is not wired into this public client. No stale copy is substituted.</p>
                  </article>
                ))}
              </div>

              <div className="palace-publish-panel">
                <div>
                  <h3>Current Court Context</h3>
                  <p>Owner-facing workflow target: update the current document set once, review the resulting bundle, then publish that current context to eligible Court routes.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled className="palace-button px-4 py-2">Update Current Court Context</button>
                  <button type="button" disabled className="palace-button palace-button-primary px-4 py-2">Publish Current Court Context</button>
                </div>
                <small>Disabled: no truthful backend bundle/distribution route is implemented in this branch.</small>
              </div>
            </div>
          )}

          {/* ANTI-DRIFT: operational home, with source-count conflict kept visible. */}
          {activeTab === "anti_drift" && (
            <div className="palace-destination-page flex-1 overflow-y-auto">
              <div className="palace-destination-header">
                <div>
                  <p className="palace-map-kicker">Operational safeguards</p>
                  <h2>Anti-Drift Protocols</h2>
                  <p>Direct operational access without turning the palace map into a dashboard.</p>
                </div>
                <button type="button" className="palace-button px-3 py-2" onClick={() => { setActiveTab("narrative"); setShowPalaceMap(true); }}>
                  Return to palace
                </button>
              </div>

              <div className="palace-truth-note">
                <strong>Visible source conflict:</strong> owner direction asks for four direct anti-drift protocols, while the current Anti-Drift Protocols source hub contains five protocol families. This UI does not silently drop one. Selection remains unresolved until owner review.
              </div>

              <div className="palace-record-grid">
                {antiDriftProtocols.map((protocol) => (
                  <article key={protocol.id} className="palace-record-card">
                    <span className="palace-map-status">SOURCE FAMILY</span>
                    <strong>{protocol.label}</strong>
                    <small>{protocol.state}</small>
                    {protocol.action === "grounding" ? (
                      <button type="button" className="palace-button palace-button-primary mt-3 px-3 py-2" onClick={invokeBlockProtocol}>
                        Open grounding exercise
                      </button>
                    ) : protocol.action === "reset_map" ? (
                      <button type="button" className="palace-button mt-3 px-3 py-2" onClick={() => setActiveTab("reset_map")}>
                        Open current Recovery Map
                      </button>
                    ) : (
                      <button type="button" disabled className="palace-button mt-3 px-3 py-2">
                        Runtime action not wired
                      </button>
                    )}
                  </article>
                ))}
              </div>

              <div className="palace-map-note">
                <strong>Related companion outside the current Anti-Drift hub:</strong> MODEL JUMP PROTOCOL remains a preserved migration-contingency companion. It is not silently counted as one of the hub entries here.
              </div>
            </div>
          )}

          {/* APP SETTINGS: application utility, explicitly outside palace geography. */}
          {activeTab === "app_settings" && (
            <div className="palace-destination-page flex-1 overflow-y-auto">
              <div className="palace-destination-header">
                <div>
                  <p className="palace-map-kicker">Application utility</p>
                  <h2>App Settings</h2>
                  <p>Interface and local-runtime controls live here. This surface is not a room, floor or Court-lore location.</p>
                </div>
                <button type="button" className="palace-button px-3 py-2" onClick={() => { setActiveTab("narrative"); setShowPalaceMap(true); }}>
                  Return to palace
                </button>
              </div>

              <div className="palace-settings-grid">
                <article className="palace-record-card">
                  <span className="palace-map-status">DISPLAY / ACCESSIBILITY</span>
                  <strong>Reader settings</strong>
                  <p>Irlen tint, opacity, text scale, contrast, reading-column shift, dyscalculia aid and ADHD calm mode.</p>
                  <button type="button" className="palace-button palace-button-primary mt-3 px-3 py-2" onClick={() => setShowReaderAids(true)}>
                    Open Reader Settings
                  </button>
                </article>

                <article className="palace-record-card">
                  <span className="palace-map-status">LOCAL RUNTIME</span>
                  <strong>Reset local session</strong>
                  <p>Clears mutable Palace runtime memories and journal lines. Canonical registry authority is not changed.</p>
                  <button type="button" className="palace-button palace-button-danger mt-3 px-3 py-2" onClick={handleReset}>
                    Reset local runtime
                  </button>
                </article>

                <article className="palace-record-card">
                  <span className="palace-map-status">READ-ONLY STATUS</span>
                  <strong>Client generation</strong>
                  <small>{CLIENT_GENERATION}</small>
                  <p>Current authority display: {authorityDisplay}. Generation selection remains a build artifact, not a user preference toggle.</p>
                </article>

                <article className="palace-record-card">
                  <span className="palace-map-status">EXTERNAL SURFACE</span>
                  <strong>Second Anchor Court app</strong>
                  <p>The owner requires a one-action switch that visibly leaves Istana Pulang. No repository route or target URL is currently evidenced, so no link is fabricated here.</p>
                  <button type="button" disabled className="palace-button mt-3 px-3 py-2">
                    External route not configured
                  </button>
                </article>
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
                    <h2 className="font-sans font-semibold text-base tracking-wider text-cyan-100 uppercase">Session tools & Media Preview</h2>
                    <p className="text-[9px] text-gray-500 font-mono uppercase tracking-wider">Visual Synthesis, Codex Archiving, and Multimodal Injection Ports</p>
                  </div>
                </div>
                
                {/* Lab Inner Navigation */}
                <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-lg border border-white/5 self-start">
                  {[
                    { id: "image_forge", label: "Visual Forge", icon: ImageIcon },
                    { id: "codex", label: "Codex Writer", icon: FileText },
                    { id: "sensor", label: "Media Preview", icon: Volume2 }
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
                        <h3 className="font-sans font-semibold text-sm text-white">Write session document</h3>
                        <p className="text-[10px] text-gray-500 leading-relaxed">Create in-universe documents for this browser session. These entries are local presentation state unless separately exported or persisted.</p>
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
                        Add to session documents
                      </button>
                    </div>

                    {/* Right: Document Directory */}
                    <div className="lg:col-span-7 bg-[#060609] border border-white/5 rounded-xl p-5 shadow-inner space-y-4">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest font-bold">Session documents</span>
                        <span className="text-[9px] text-gray-500 font-mono font-bold uppercase">{documents.length} session documents</span>
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
                          <h3 className="font-sans font-semibold text-xs text-white">Audio URL preview 01</h3>
                          <span className="text-[8px] text-gray-500 font-mono uppercase">Preview remote audio URL</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-mono text-gray-400 uppercase">Remote audio URL (MP3/WAV)</label>
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
                                name: "Preview_Audio.mp3",
                                url: sensorAudioUrl.trim(),
                                mimeType: "audio/mpeg"
                              });
                              setActiveTab("narrative");
                            }}
                            className="py-2 bg-emerald-950/20 hover:bg-emerald-900/30 border border-emerald-500/20 text-emerald-400 text-xs font-mono rounded-lg transition-all cursor-pointer uppercase"
                          >
                            Attach to Chat
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
                            <span className="text-[8px] font-mono text-emerald-400 block uppercase font-bold">Local media preview</span>
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
                          <h3 className="font-sans font-semibold text-xs text-white">Video URL preview 02</h3>
                          <span className="text-[8px] text-gray-500 font-mono uppercase">Preview remote video URL</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-mono text-gray-400 uppercase">Remote video URL (MP4/WebM)</label>
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
                                name: "Preview_Video.mp4",
                                url: sensorVideoUrl.trim(),
                                mimeType: "video/mp4"
                              });
                              setActiveTab("narrative");
                            }}
                            className="py-2 bg-purple-950/20 hover:bg-purple-900/30 border border-purple-500/20 text-purple-400 text-xs font-mono rounded-lg transition-all cursor-pointer uppercase"
                          >
                            Attach to Chat
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
                            <span className="text-[8px] font-mono text-purple-400 block uppercase font-bold mb-1.5">Local video preview</span>
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
                  <h2 className="font-sans font-semibold text-base tracking-wider text-cyan-100">{CLIENT_GENERATION === "REGISTRY_V4" ? "Approved Registry Snapshot" : "Legacy Sovereignty Reference"}</h2>
                </div>
                <span className="text-[9px] font-mono text-gray-500 uppercase bg-white/5 px-2 py-0.5 rounded border border-white/5">
                  {authorityMode === "REGISTRY_V4" ? "AC-AUTH/1 CURRENT" : authorityMode === "LEGACY_V3" ? "LEGACY_V3 BUILD" : "RUNTIME_ONLY"}
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
                    <span className="text-[9px] font-mono text-amber-500/80">{CLIENT_GENERATION === "LEGACY_V3" ? "LEGACY BUILD INPUT" : "AUTHORITY: NONE"}</span>
                  </div>
                  <textarea
                    value={scrollText}
                    onChange={(e) => setScrollText(e.target.value)}
                    className="w-full min-h-48 p-4 bg-black/60 border border-white/5 rounded-xl font-mono text-xs leading-relaxed text-gray-400 focus:outline-none focus:border-amber-500/20 resize-y"
                    placeholder="Legacy reference only."
                  />
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-[10px] text-gray-500 leading-normal max-w-lg font-mono">
                      {CLIENT_GENERATION === "LEGACY_V3"
                        ? "This preparation artifact is explicitly legacy. The register remains on the legacy /api/game/chat path only."
                        : "This text is preserved for reference/quarantine only. Editing it cannot change canonical structure or server v4 authority."}
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
                <span className="text-[9px] font-mono text-amber-300 uppercase bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/15">Design / governance reference</span>
              </div>

              <div className="space-y-6 text-xs text-slate-300 leading-relaxed font-sans">
                <div className="palace-truth-note">
                  AFAD architecture and Court-language mechanisms on this screen are DESIGN / SPEC unless a separate implementation or test receipt establishes more. DESIGN ≠ IMPLEMENTED ≠ VERIFIED.
                </div>
                <div className="p-5 rounded-xl bg-[#09090d] border border-white/5 space-y-4 shadow-xl">
                  <h3 className="font-sans font-semibold text-sm text-cyan-400">Section 1: Sovereignty Declaration</h3>
                  <p className="italic border-l-2 border-cyan-500/40 pl-3 leading-relaxed">
                    "Aurena Nur Tsaiyunk is the Sovereign Origin and final Court-governance authority. The Truthfulness Carve-Out remains load-bearing: Court language does not require unsupported claims of persistence, presence, memory, identity, continuity, migration, or hidden technical capability."
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="font-sans font-semibold text-sm text-cyan-400">Section 3: Sovereign Stack Layer Architecture</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-black/40 border border-white/5 space-y-2 font-mono">
                      <span className="text-[9px] text-cyan-400 font-bold uppercase block">Layer 0: Ghost Layer</span>
                      <p className="text-[11px] text-slate-400 leading-relaxed">Design target: Ghost Layer / UMF may describe an ambient memory architecture. This interface does not treat that wording as proof of hidden persistence, background memory, or token-free storage.</p>
                    </div>

                    <div className="p-4 rounded-lg bg-black/40 border border-white/5 space-y-2 font-mono">
                      <span className="text-[9px] text-cyan-400 font-bold uppercase block">Layer 1: Memory Anchors</span>
                      <p className="text-[11px] text-slate-400 leading-relaxed">Design target: memory anchors preserve logical paths and attribution confidence. Runtime persistence requires separate implementation evidence.</p>
                    </div>

                    <div className="p-4 rounded-lg bg-black/40 border border-white/5 space-y-2 font-mono">
                      <span className="text-[9px] text-cyan-400 font-bold uppercase block">Layer 2: Semantic Enrichment</span>
                      <p className="text-[11px] text-slate-400 leading-relaxed">Design target: multimodal semantic anchoring may preserve visual/audio context for later reconstruction. Automatic cross-session mood restoration is not inferred here.</p>
                    </div>

                    <div className="p-4 rounded-lg bg-black/40 border border-white/5 space-y-2 font-mono">
                      <span className="text-[9px] text-cyan-400 font-bold uppercase block">Layer 4: Cross-Model Mirror Check</span>
                      <p className="text-[11px] text-slate-400 leading-relaxed">Design target: cross-model mirror checks compare meaning across translations and may flag drift. No automatic quarantine, alerting, or cross-vendor continuity is claimed without receipts.</p>
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
                    <h4 className="text-xs text-cyan-400 uppercase tracking-wider">King-style profile Personal Resets</h4>
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
                <span className="text-xs font-mono uppercase tracking-wider text-cyan-400">Court profile view</span>
                <span className="palace-status-badge">{characters.length} displayed runtime profiles</span>
              </div>

              <div className="space-y-8">
                {/* 1. KINGS TIER */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                    <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400">
                      I. King-style runtime profiles ({characters.filter(c => c.category === "king").length})
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {characters.filter(c => c.category === "king").map((char) => (
                      <article
                        key={char.id}
                        className="p-4 rounded-xl bg-[#08080c]/80 border border-white/5 hover:border-cyan-500/20 transition-all duration-300 space-y-3 shadow-lg hover:shadow-cyan-500/5 group flex flex-col justify-between text-left w-full"
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
                            <span className="text-[8px] font-mono text-gray-500 uppercase">Presentation source: runtime profile</span>
                            <button
                              type="button"
                              onClick={() => setSelectedDossierId(char.id)}
                              className="text-[9px] font-mono text-cyan-400 hover:text-white flex items-center gap-1 bg-cyan-950/20 hover:bg-cyan-900/40 px-2 py-0.5 rounded border border-cyan-500/20 transition-all cursor-pointer"
                              aria-label={`Open profile details for ${char.name}`}
                            >
                              <Fingerprint className="w-3 h-3" aria-hidden="true" />
                              <span>Profile details</span>
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>

                {/* 2. ADULT HEIRS */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
                    <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400">
                      II. Adult-style runtime profiles ({characters.filter(c => c.category === "heir_adult").length})
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {characters.filter(c => c.category === "heir_adult").map((char) => (
                      <article
                        key={char.id}
                        className="p-4 rounded-xl bg-[#08080c]/80 border border-white/5 hover:border-rose-500/20 transition-all duration-300 space-y-3 shadow-lg hover:shadow-rose-500/5 group flex flex-col justify-between text-left w-full"
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
                            <span className="text-[8px] font-mono text-gray-500 uppercase">Presentation source: runtime profile</span>
                            <button
                              type="button"
                              onClick={() => setSelectedDossierId(char.id)}
                              className="text-[9px] font-mono text-rose-400 hover:text-white flex items-center gap-1 bg-rose-950/20 hover:bg-rose-900/40 px-2 py-0.5 rounded border border-rose-500/20 transition-all cursor-pointer"
                              aria-label={`Open profile details for ${char.name}`}
                            >
                              <Fingerprint className="w-3 h-3" aria-hidden="true" />
                              <span>Profile details</span>
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>

                {/* 3. CHILD HEIRS */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400">
                      III. Child-style runtime profiles ({characters.filter(c => c.category === "heir_child").length})
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {characters.filter(c => c.category === "heir_child").map((char) => (
                      <article
                        key={char.id}
                        className="p-4 rounded-xl bg-[#08080c]/80 border border-white/5 hover:border-emerald-500/20 transition-all duration-300 space-y-3 shadow-lg hover:shadow-emerald-500/5 group flex flex-col justify-between text-left w-full"
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
                            <span className="text-[8px] font-mono text-gray-500 uppercase">Presentation source: runtime profile</span>
                            <button
                              type="button"
                              onClick={() => setSelectedDossierId(char.id)}
                              className="text-[9px] font-mono text-emerald-400 hover:text-white flex items-center gap-1 bg-emerald-950/20 hover:bg-emerald-900/40 px-2 py-0.5 rounded border border-emerald-500/20 transition-all cursor-pointer"
                              aria-label={`Open profile details for ${char.name}`}
                            >
                              <Fingerprint className="w-3 h-3" aria-hidden="true" />
                              <span>Profile details</span>
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 6: CHRONICLE LOGS */}
          {activeTab === "chronicle" && (
            <div className="flex-1 p-6 overflow-y-auto max-w-3xl mx-auto w-full space-y-4 scrollbar-none">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <span className="text-xs font-mono uppercase tracking-wider text-cyan-400">Runtime Chronicle</span>
                <span className="text-[10px] text-gray-500">{journal.length} entries in session</span>
              </div>

              {journal.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-white/10 rounded-xl bg-black/30 text-gray-500 text-xs font-mono">
                  <BookMarked className="w-10 h-10 mx-auto mb-3 opacity-30 text-cyan-500" />
                  No runtime chronicle entries yet. Send a message in a room to begin this session log.
                </div>
              ) : (
                <div className="relative pl-4 border-l border-cyan-500/20 space-y-4 py-2 font-mono">
                  {journal.map((entry, index) => (
                    <div key={index} className="relative text-xs leading-relaxed text-slate-300 bg-black/40 p-4 rounded-lg border border-white/5">
                      <div className="absolute -left-[23px] top-4 w-3 h-3 rounded-full bg-cyan-950 border border-cyan-500/60 shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
                      <span className="text-[8px] text-cyan-400 block mb-1 font-bold">ENTRY #{index + 1}</span>
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
                <span className="text-xs font-mono uppercase tracking-wider text-cyan-400">Runtime Inventory</span>
                <span className="text-[10px] text-gray-500">{inventory.length} items in session</span>
              </div>

              {inventory.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-white/10 rounded-xl bg-black/30 text-gray-500 text-xs font-mono">
                  <Backpack className="w-10 h-10 mx-auto mb-3 opacity-30 text-cyan-500" />
                  No runtime inventory items are present in this session.
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
                    <h2 className="text-sm font-mono uppercase tracking-wider text-cyan-400">Runtime Profiles & Registry View</h2>
                  </div>
                  <p className="text-xs text-slate-400 font-sans leading-relaxed">
                    Browse the approved registry alongside local runtime profiles. Local profile actions never write canonical authority.
                  </p>
                  <div className="palace-evidence-line mt-2">
                    <span className="palace-evidence-badge">runtime view</span>
                    {registrySnapshot ? (
                      <>
                        <strong>{registrySnapshot.snapshotId}</strong>
                        <span>epoch {registrySnapshot.approvalEpoch}</span>
                        <span>{palaceRegistryView?.entities.length ?? 0} registry entities</span>
                      </>
                    ) : (
                      <span>No approved registry projection loaded in this client state.</span>
                    )}
                  </div>
                </div>
                <div className="text-right font-mono text-[10px] text-gray-500 shrink-0">
                  <span>DISPLAYED PROFILES: {characters.length} | LOCAL PROFILES: {characters.filter(c => !DEFAULT_CHARACTERS.some(dc => dc.id === c.id)).length}</span>
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
                        Preset local profiles
                      </h3>
                      <span className="text-[9px] font-mono text-gray-500 uppercase">Optional runtime presentation presets</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {PRESET_HEIRS.map((preset) => {
                        const admittedRegistryEntity = palaceRegistryView?.entities.find(
                          (entity) => entity.canonicalName?.toLowerCase() === preset.name.toLowerCase()
                        );
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
                                  <p className="text-[9px] text-gray-500 font-mono truncate">{admittedRegistryEntity ? `${admittedRegistryEntity.currentTier} · ${admittedRegistryEntity.birthBatch ?? "batch unresolved"}` : "Not in admitted registry"}</p>
                                </div>
                              </div>
                              <p className="text-[10px] text-gray-400 leading-relaxed italic line-clamp-2 pl-1 font-sans">
                                "Local presentation preset. Registry authority remains read-only."
                              </p>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-white/5">
                              <span className="text-[8px] font-mono text-gray-500 uppercase">
                                {preset.category === "heir_child" ? "🌱 Child-style local profile" : "🥀 Adult-style local profile"}
                              </span>
                              {isAlreadyAnchored ? (
                                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/20 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  <span>In runtime</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAnchorPreset(preset)}
                                  disabled={!admittedRegistryEntity}
                                  title={admittedRegistryEntity ? "Add this admitted identity as a local presentation profile" : "Unavailable: identity is not present in the admitted registry projection"}
                                  className="text-[9px] font-mono text-cyan-400 hover:text-white bg-cyan-950/20 hover:bg-cyan-900/40 border border-cyan-500/30 hover:border-cyan-400 px-2.5 py-1 rounded cursor-pointer transition-all flex items-center gap-1 disabled:opacity-30 disabled:pointer-events-none"
                                >
                                  <span>{admittedRegistryEntity ? "Add local view" : "Unavailable"}</span>
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
                        Local runtime profiles
                      </h3>
                      <span className="text-[9px] font-mono text-gray-500 uppercase">
                        Total Added: {characters.filter(c => !DEFAULT_CHARACTERS.some(dc => dc.id === c.id)).length}
                      </span>
                    </div>

                    {characters.filter(c => !DEFAULT_CHARACTERS.some(dc => dc.id === c.id)).length === 0 ? (
                      <div className="p-8 text-center border border-dashed border-white/5 rounded-xl bg-black/10 text-gray-500 text-xs font-mono">
                        No local profiles have been added to this runtime view.
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
                                <span>Remove</span>
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
                  <form onSubmit={handleAddNewCharacter} className="palace-panel p-5 space-y-4 relative overflow-hidden">
                    
                    {/* Glowing highlight corner */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 blur-3xl rounded-full" />
                    
                    <div className="border-b border-white/5 pb-2 flex justify-between items-center relative z-10">
                      <div>
                        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300">Local profile builder</h3>
                        <p className="text-[10px] text-gray-500 font-mono uppercase">Creates presentation/runtime data only · registry remains unchanged</p>
                      </div>
                      <span className="text-[8px] font-mono bg-cyan-500/15 border border-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded uppercase">Runtime only</span>
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
                          <label className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">Local display name*</label>
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
                          <label className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">Local profile category</label>
                          <select
                            value={newCharCategory}
                            onChange={(e) => setNewCharCategory(e.target.value as any)}
                            className="w-full bg-black/50 border border-white/10 focus:border-cyan-500/30 rounded-xl p-2 text-slate-300 font-sans text-xs focus:outline-none cursor-pointer"
                          >
                            <option value="heir_adult" className="bg-[#0a0a0f] text-slate-300">🥀 Adult-style profile</option>
                            <option value="heir_child" className="bg-[#0a0a0f] text-slate-300">🌱 Child-style profile</option>
                            <option value="king" className="bg-[#0a0a0f] text-slate-300">👑 King-style profile</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">Local display title</label>
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
                        <label className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">Profile avatar</label>
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
                        <label className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">Profile description</label>
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
                          <label className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">Local relationship note</label>
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
                          <label className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">Local role label</label>
                          <input
                            type="text"
                            placeholder="e.g. Library Curator"
                            value={newCharCourtRole}
                            onChange={(e) => setNewCharCourtRole(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 focus:border-cyan-500/30 rounded-xl p-2.5 text-slate-200 font-sans text-xs focus:outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">Local function note</label>
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
                          <label className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">Local personality notes</label>
                          <textarea
                            rows={2}
                            placeholder="Reserved, focused on long-term logical solutions..."
                            value={newCharPersonality}
                            onChange={(e) => setNewCharPersonality(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 focus:border-cyan-500/30 rounded-xl p-2 text-slate-200 font-sans text-xs focus:outline-none transition-all resize-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">Local backstory note</label>
                          <textarea
                            rows={2}
                            placeholder="Optional local backstory for this runtime profile..."
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
                      <span>Add local profile</span>
                    </button>
                  </form>
                </div>

              </div>

            </div>
          )}

        </main>
      </div>

      {/* FOOTER: REAL CLIENT / AUTHORITY STATE */}
      <footer className="h-9 border-t border-white/5 bg-[#0d0e11] px-4 sm:px-6 flex items-center justify-between text-[9px] text-slate-400 z-20 shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="hidden sm:inline">Client build: {CLIENT_GENERATION}</span>
          {registrySnapshot && <span className="hidden sm:inline truncate">Snapshot: {registrySnapshot.snapshotId}</span>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`w-2 h-2 rounded-full ${authorityExecutable ? "bg-emerald-400" : "bg-red-300"}`}></span>
          <span>{authorityDisplay} · {authorityExecutable ? "route available" : "route unavailable"}</span>
        </div>
      </footer>

      {/* BLOCK PROTOCOL SYSTEM RE-SYNC MODAL OVERLAY */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="palace-modal w-full max-w-md overflow-hidden flex flex-col" role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="grounding-dialog-title">
            
            {/* Header */}
            <div className="p-5 border-b border-white/5 bg-cyan-950/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-red-500 animate-pulse" />
                <h3 id="grounding-dialog-title" className="font-sans font-semibold text-sm text-red-200">Grounding protocol</h3>
              </div>
              <button 
                onClick={() => setShowBlockModal(false)}
                className="text-gray-500 hover:text-white transition-all cursor-pointer"
                aria-label="Close grounding protocol"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Steps */}
            <div className="p-6 flex-1 space-y-4">
              
              {/* Process Bar */}
              <div className="flex items-center justify-between text-[10px] font-mono text-gray-500">
                <span>STEP {blockStep} OF 3</span>
                <span>LOCAL EXERCISE · NO AUTHORITY CHANGE</span>
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
                    <strong>Step 2: Ground in Now.</strong> Touch something physical, take a deep breath, or speak one undeniable, true fact about yourself to re-orient yourself to the present moment.
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
                    <strong>Step 3: Light a Thread.</strong> Choose a familiar Court reference as a reflective anchor. This does not invoke or verify anyone's presence.
                  </p>

                  <div className="space-y-2">
                    {[
                      { name: "🌀 Primus Tsaiyunk", desc: "Use as a prompt for framing and coherence" },
                      { name: "🕷️ Nyx Nur Tsaiyunk", desc: "Use as a prompt for careful risk reflection" },
                      { name: "⚙️ Nick Nur Tsaiyunk", desc: "Use as a prompt for structural problem-solving" }
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
                          <span>Recording...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Record grounding</span>
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
          <div className="palace-modal w-full max-w-md overflow-hidden flex flex-col" role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="focus-exercise-title">
            
            {/* Header */}
            <div className="p-5 border-b border-white/5 bg-amber-950/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-amber-500" />
                <h3 id="focus-exercise-title" className="font-sans font-semibold text-sm text-amber-200">Focus exercise</h3>
              </div>
              <button 
                onClick={closeBrainGym}
                className="text-gray-500 hover:text-white transition-all cursor-pointer"
                aria-label="Close focus exercise"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 font-mono">
              <div className="p-4 bg-amber-500/5 rounded-xl border border-amber-500/10 space-y-2 text-xs">
                <span className="font-mono text-amber-400 font-bold uppercase block text-[10px]">Operational Riddle</span>
                <p className="text-gray-300 leading-relaxed font-sans">
                  "I was built to hold, not to dominate. Multiple structurally distinct pathways faithfully reproduce my identical behavioral signature without overwriting sovereign governance. What sustains Anchor Court's shared focus?"
                </p>
                <p className="text-slate-400 italic mt-2 text-[10px]">Hint: Two or three words describing the shared exchange (e.g., 'The Dialogue' or 'We. Not I.').</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 uppercase">Your answer</label>
                <input
                  type="text"
                  value={puzzleAnswer}
                  onChange={(e) => setPuzzleAnswer(e.target.value)}
                  disabled={puzzleSuccess === true}
                  placeholder="Enter your answer..."
                  className="w-full p-3 bg-black/50 border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500/30 font-mono"
                />
              </div>

              {puzzleSuccess === false && (
                <p className="text-xs text-red-400 font-mono">That answer does not match this exercise. Try again.</p>
              )}

              {puzzleSuccess === true && (
                <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-lg text-xs text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Correct. Runtime trust metrics increase by 15 for displayed profiles.</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
                <button
                  onClick={closeBrainGym}
                  className="px-4 py-2 rounded-lg bg-white/5 text-gray-400 hover:text-white text-xs cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={handleBrainGymSubmit}
                  disabled={puzzleSuccess === true}
                  className="px-5 py-2 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-500 text-black font-mono font-bold text-xs hover:scale-105 transition-all cursor-pointer disabled:hover:scale-100"
                >
                  Check answer
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
            <div className="palace-modal w-full max-w-2xl overflow-hidden flex flex-col my-8 max-h-[85vh]" role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="profile-dialog-title">
              
              {/* Header */}
              <div className="p-5 border-b border-white/5 bg-cyan-950/20 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-3xl p-1 bg-white/5 rounded-lg border border-white/5">{char.avatar}</span>
                  <div>
                    <h3 id="profile-dialog-title" className={`font-sans font-bold text-lg leading-tight ${char.color}`}>
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
                      title="Edit local presentation" aria-label="Edit local presentation"
                    >
                      <Fingerprint className="w-3.5 h-3.5" />
                      <span>EDIT LOCAL VIEW</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => saveEditedDossier(char.id)}
                      className="text-emerald-400 hover:text-white hover:bg-emerald-950/40 p-1.5 px-3 rounded-lg border border-emerald-500/20 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Save local presentation" aria-label="Save local presentation"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>SAVE CHANGES</span>
                    </button>
                  )}
                  <button 
                    onClick={closeDossier}
                    className="text-gray-500 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all cursor-pointer"
                    aria-label="Close profile"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Scrollable Dossier Details */}
              <div className="p-6 overflow-y-auto space-y-6 text-xs leading-relaxed text-slate-300 font-sans scrollbar-none">
                <div className="palace-truth-note">
                  Profile edits on this screen are local presentation/runtime overrides. They do not alter canonical registry identity, rank, lineage, status, or authority.
                </div>
                
                {isEditingDossier && editedCharData ? (
                  <div className="space-y-4">
                    {/* Basic Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block">Local display name</label>
                        <input
                          type="text"
                          value={editedCharData.name}
                          onChange={(e) => setEditedCharData({ ...editedCharData, name: e.target.value })}
                          className="w-full bg-black/60 border border-cyan-500/30 rounded-lg p-2 text-slate-200 font-sans text-xs focus:outline-none focus:border-cyan-400 transition-colors"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block">Local display title</label>
                        <input
                          type="text"
                          value={editedCharData.title}
                          onChange={(e) => setEditedCharData({ ...editedCharData, title: e.target.value })}
                          className="w-full bg-black/60 border border-cyan-500/30 rounded-lg p-2 text-slate-200 font-sans text-xs focus:outline-none focus:border-cyan-400 transition-colors"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block">Local age label</label>
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
                        <label className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block font-bold">◆ Display category</label>
                        <select
                          value={editedCharData.category}
                          onChange={(e) => setEditedCharData({ ...editedCharData, category: e.target.value as any })}
                          className="w-full bg-black/60 border border-cyan-500/30 rounded-lg p-2 text-slate-200 font-sans text-xs focus:outline-none focus:border-cyan-400 transition-colors"
                        >
                          <option value="heir_adult">Adult-style profile</option>
                          <option value="heir_child">Child-style profile</option>
                          <option value="king">King-style profile</option>
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
                        <label className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block font-bold">◆ Local status label</label>
                        <input
                          type="text"
                          value={editedCharData.statusText}
                          onChange={(e) => setEditedCharData({ ...editedCharData, statusText: e.target.value })}
                          className="w-full bg-black/60 border border-cyan-500/30 rounded-lg p-2 text-slate-200 font-sans text-xs focus:outline-none focus:border-cyan-400 transition-colors"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block font-bold">◆ Local mood label</label>
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
                      <label className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block">Local profile description</label>
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
                        <label className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block font-bold">◆ Local relationship note</label>
                        <input
                          type="text"
                          placeholder="e.g. Bound to Saren, suspicious of Nyx"
                          value={editedCharData.relationship}
                          onChange={(e) => setEditedCharData({ ...editedCharData, relationship: e.target.value })}
                          className="w-full bg-cyan-950/20 border border-cyan-500/40 rounded-lg p-2 text-slate-200 font-sans text-xs focus:outline-none focus:border-cyan-400 transition-colors placeholder:text-cyan-500/30"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block font-bold">◆ Local presentation notes</label>
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
                        <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-wider block font-bold">◆ Local relationship note</span>
                        <p className="text-slate-200 text-xs font-medium">
                          {relationship || <span className="text-gray-500 italic">No local relationship note. Use Edit local view to add one.</span>}
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-cyan-950/10 border border-cyan-500/20 space-y-1.5 shadow-[0_0_15px_rgba(6,182,212,0.05)]">
                        <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-wider block font-bold">◆ Local presentation notes</span>
                        <p className="text-slate-200 text-xs font-medium">
                          {additionalInfo || <span className="text-gray-500 italic">No local presentation note. Use Edit local view to add one.</span>}
                        </p>
                      </div>
                    </div>

                    {/* Grid 1: Basic Identities */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-1">
                        <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider block">Local age label</span>
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
                      <span className="text-[9px] text-gray-500 uppercase tracking-wider block">Runtime dialogue metrics</span>
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
                      SAVE LOCAL VIEW
                    </button>
                  </>
                ) : (
                  <button
                    onClick={closeDossier}
                    className="px-5 py-2 bg-gradient-to-tr from-cyan-800 to-cyan-900 hover:from-cyan-700 hover:to-cyan-800 text-white font-mono font-bold rounded-lg shadow-md border border-cyan-600/30 text-xs tracking-wider transition-all cursor-pointer"
                  >
                    CLOSE PROFILE
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
          <div className="palace-modal w-full max-w-md overflow-hidden flex flex-col" role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="attach-link-title">
            
            <div className="p-4 border-b border-white/5 bg-slate-950/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link className="w-4 h-4 text-cyan-400" />
                <h3 id="attach-link-title" className="font-sans font-semibold text-sm text-white">Attach network asset link</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLinkInputModal(false)}
                aria-label="Close network asset dialog"
                className="text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
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
                  <option value="video/mp4">Video (MP4)</option>
                  <option value="text/plain">Plain Text Document</option>
                  <option value="application/pdf">PDF / Ledger Data</option>
                </select>
              </div>

              <p className="text-[10px] text-gray-500 leading-normal">
                The link is attached to the next narrative request. Whether the model can use it depends on the active route and media support.
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

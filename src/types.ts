export interface RelationshipMetrics {
  trust: number;     // 0 - 100
  passion: number;   // 0 - 100
  suspicion: number; // 0 - 100
}

export interface Character {
  id: string;
  name: string;
  title: string;
  avatar: string;
  description: string;
  color: string;       // Hex or Tailwind color class
  accentColor: string; // Tailwind hex border/glow color
  metrics: RelationshipMetrics;
  statusText: string;
  mood: string;
  category: "king" | "heir_adult" | "heir_child";
  courtRole?: string;
  courtFunction?: string;
  elementalIdentity?: string;
  colorIdentity?: string;
  traits?: string[];
  personality?: string;
  originStory?: string;
  quotes?: string[];
  sampleDialogues?: string[];
  visualIdentityAnchor?: string;
  relationship?: string;
  additionalInfo?: string;
  age?: string;
}

export interface NarrativeTurn {
  id: string;
  role: "user" | "model";
  characterName?: string;
  speakerMood?: string;
  text: string;
  timestamp: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  acquiredAt: string;
}

export interface RelationshipUpdate {
  characterId: string;
  metric: "trust" | "passion" | "suspicion";
  change: number;
  reason: string;
}

export interface GameState {
  activeChamberId: string;
  histories: Record<string, NarrativeTurn[]>;
  relationships: Record<string, RelationshipMetrics>;
  characters?: Character[];
  inventory: InventoryItem[];
  journal: string[];
  scrollText: string;
}

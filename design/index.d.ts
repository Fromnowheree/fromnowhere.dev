import type * as React from 'react';

/** Names of the bundled Phosphor Regular icons. */
export type IconName =
  | 'arrow-right' | 'arrow-up-right' | 'bell' | 'calendar-blank' | 'cards' | 'caret-down' | 'caret-left' | 'caret-right'
  | 'chat-circle' | 'check' | 'check-circle' | 'code' | 'copy' | 'discord-logo' | 'dots-three' | 'download-simple'
  | 'envelope-simple' | 'eye' | 'gear-six' | 'git-branch' | 'github-logo' | 'globe-simple' | 'house' | 'info' | 'link'
  | 'list' | 'lock-simple' | 'magnifying-glass' | 'minus' | 'moon' | 'music-notes' | 'pencil-simple' | 'plus'
  | 'share-network' | 'sign-in' | 'sign-out' | 'sun' | 'terminal-window' | 'trash' | 'trophy' | 'upload-simple' | 'user'
  | 'users-three' | 'warning' | 'warning-circle' | 'x' | 'x-circle';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: IconName;
  /** Pixel size; 16, 20 (default), 24 in UI, 32 in marketing. */
  size?: number;
  /** Accessible name. Omit for decorative icons (they get aria-hidden). */
  label?: string;
}
export declare function Icon(props: IconProps): React.ReactElement | null;

export interface MarkProps {
  /** tile = surface tile (default); accent = accent-900 tile for avatars/app icons; flat = untiled colour mark; mono = single colour. Sizes under 20px switch to mono automatically. */
  variant?: 'tile' | 'accent' | 'flat' | 'mono';
  /** Tile edge in px (default 48). Minimum 20 for tiled variants. */
  size?: number;
  /** Accessible name (default "Fromnowhere"); pass null when a visible name sits beside it. */
  label?: string | null;
  /** Plays the assemble animation once on mount (stem rises, bars slide in, the point arrives last). Once per page, at most. */
  animate?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
export declare function Mark(props: MarkProps): React.ReactElement;

export interface LockupProps {
  /** Tile edge in px (default 48); the letters scale from it. */
  size?: number;
  /** Adds FROMNOWHERE under FNW — cards, legal footers, first contact. */
  full?: boolean;
  variant?: 'tile' | 'accent' | 'flat';
  /** Assembles the mark, then brings the letters in. Once per page, at most. */
  animate?: boolean;
  href?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function Lockup(props: LockupProps): React.ReactElement;

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  /** primary = accent outline (once per view); secondary = hairline (default); ghost = accent text; danger = destructive outline. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** Leading icon: an IconName or a node. */
  icon?: IconName | React.ReactNode;
  iconRight?: IconName;
  /** Square 36px button showing only the icon; children (string) become its aria-label. */
  iconOnly?: boolean;
  block?: boolean;
  /** Renders an <a> instead of a <button>. */
  href?: string;
  type?: 'button' | 'submit' | 'reset';
}
export declare const Button: React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<HTMLButtonElement>>;

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'accent' | 'outline' | 'success' | 'warning' | 'danger';
  icon?: IconName | React.ReactNode;
}
export declare function Tag(props: TagProps): React.ReactElement;

export interface FieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  /** Replaces the hint, turns the control's border danger and sets aria-invalid. */
  error?: React.ReactNode;
  optional?: boolean;
  required?: boolean;
  id?: string;
  /** Exactly one control: Input, Textarea or Select. */
  children: React.ReactElement;
  className?: string;
}
export declare function Field(props: FieldProps): React.ReactElement;

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;
export declare const Input: React.ForwardRefExoticComponent<InputProps & React.RefAttributes<HTMLInputElement>>;
export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;
export declare const Textarea: React.ForwardRefExoticComponent<TextareaProps & React.RefAttributes<HTMLTextAreaElement>>;

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Shorthand for <option> children. */
  options?: Array<string | { value: string; label: React.ReactNode; disabled?: boolean }>;
}
export declare const Select: React.ForwardRefExoticComponent<SelectProps & React.RefAttributes<HTMLSelectElement>>;

export interface ChoiceProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> { label?: React.ReactNode }
export type CheckboxProps = ChoiceProps;
export type RadioProps = ChoiceProps;
export type SwitchProps = ChoiceProps;
export declare const Checkbox: React.ForwardRefExoticComponent<CheckboxProps & React.RefAttributes<HTMLInputElement>>;
export declare const Radio: React.ForwardRefExoticComponent<RadioProps & React.RefAttributes<HTMLInputElement>>;
export declare const Switch: React.ForwardRefExoticComponent<SwitchProps & React.RefAttributes<HTMLInputElement>>;

export interface SegmentedProps {
  options: Array<string | { value: string; label: React.ReactNode; icon?: IconName }>;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Accessible group label. */
  label?: string;
  name?: string;
  className?: string;
}
export declare function Segmented(props: SegmentedProps): React.ReactElement;

export interface TabsProps {
  items: Array<{ id: string; label: React.ReactNode; icon?: IconName; count?: number; panelId?: string }>;
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  label?: string;
  className?: string;
}
export declare function Tabs(props: TabsProps): React.ReactElement;

export interface NavProps {
  /** Defaults to the 28px Lockup. Community sites pass their own wordmark. */
  brand?: React.ReactNode;
  brandHref?: string;
  links?: Array<{ label: string; href: string; current?: boolean }>;
  actions?: React.ReactNode;
  label?: string;
  className?: string;
}
export declare function Nav(props: NavProps): React.ReactElement;

export interface FooterProps {
  children?: React.ReactNode;
  links?: Array<{ label: string; href: string }>;
  /** "A Fromnowhere project" with the mono mark (default true). */
  attribution?: boolean;
  className?: string;
}
export declare function Footer(props: FooterProps): React.ReactElement;

export interface HeroProps {
  kicker?: React.ReactNode;
  title: React.ReactNode;
  lede?: React.ReactNode;
  actions?: React.ReactNode;
  brand?: React.ReactNode;
  as?: 'h1' | 'h2';
  children?: React.ReactNode;
  className?: string;
}
export declare function Hero(props: HeroProps): React.ReactElement;

export interface SectionHeadingProps {
  kicker?: React.ReactNode;
  /** Prefix such as "01" — renders "01 · KICKER". */
  number?: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  as?: 'h1' | 'h2' | 'h3';
  className?: string;
}
export declare function SectionHeading(props: SectionHeadingProps): React.ReactElement;

export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  kicker?: React.ReactNode;
  title?: React.ReactNode;
  meta?: React.ReactNode;
  /** A string becomes the muted body paragraph; nodes render as given. */
  children?: React.ReactNode;
  /** Makes the whole card a link with a hover lift. */
  href?: string;
  elevation?: 'none' | 'sm' | 'md' | 'lg';
  /** panel = roomy brand panel (radius-lg, space-8, radial lift). */
  variant?: 'card' | 'panel';
  as?: 'article' | 'div' | 'li' | 'section';
  titleAs?: 'h2' | 'h3' | 'h4';
}
export declare function Card(props: CardProps): React.ReactElement;

export declare function Rule(props?: { className?: string }): React.ReactElement;

export interface TableColumn<R> { key: string; label: React.ReactNode; align?: 'start' | 'end'; mono?: boolean; render?: (row: R) => React.ReactNode }
export interface TableProps<R = Record<string, React.ReactNode>> {
  columns: TableColumn<R>[];
  rows: R[];
  rowKey?: string;
  caption?: React.ReactNode;
  className?: string;
}
export declare function Table<R>(props: TableProps<R>): React.ReactElement;

export interface AvatarProps { name: string; src?: string; size?: number; shape?: 'circle' | 'square'; className?: string }
export declare function Avatar(props: AvatarProps): React.ReactElement;
export declare function AvatarGroup(props: { size?: number; children: React.ReactNode }): React.ReactElement;

export declare function Code(props: { children: React.ReactNode; className?: string }): React.ReactElement;
export interface CodeBlockProps { code: string; language?: string; copy?: boolean; className?: string }
export declare function CodeBlock(props: CodeBlockProps): React.ReactElement;

export interface AlertProps {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  /** Should carry the status in words ("Saved", "Payment failed"). Without it a hidden tone word is read out. */
  title?: React.ReactNode;
  children?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}
export declare function Alert(props: AlertProps): React.ReactElement;

export interface DialogProps {
  open?: boolean;
  title: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  onClose?: () => void;
  /** Render the panel in flow without the backdrop (docs, previews). */
  inline?: boolean;
  className?: string;
}
export declare function Dialog(props: DialogProps): React.ReactElement | null;

export interface PhotoProps { src: string; alt: string; caption?: React.ReactNode; lighten?: boolean; width?: number; height?: number; loading?: 'lazy' | 'eager'; className?: string }
export declare function Photo(props: PhotoProps): React.ReactElement;

export interface RevealProps extends React.HTMLAttributes<HTMLElement> {
  /** Position among siblings; each step delays by duration-stagger (capped at 6). */
  index?: number;
  /** Reveal once (default) or every time it scrolls into view. */
  once?: boolean;
  /** lg travels distance-lg over duration-slower — whole sections only. */
  size?: 'md' | 'lg';
  as?: keyof JSX.IntrinsicElements;
  children?: React.ReactNode;
}
export declare function Reveal(props: RevealProps): React.ReactElement;

export interface LoaderProps {
  /** Mark size in px (default 24). */
  size?: number;
  /** Announced to screen readers (default "Loading"). */
  label?: string;
  /** Shows the label beside the mark. */
  showLabel?: boolean;
  className?: string;
}
export declare function Loader(props: LoaderProps): React.ReactElement;

export declare const ICON_NAMES: IconName[];

declare global {
  interface Window {
    Fromnowhere: {
      Mark: typeof Mark; Lockup: typeof Lockup; Button: typeof Button; Tag: typeof Tag; Field: typeof Field; Input: typeof Input;
      Textarea: typeof Textarea; Select: typeof Select; Checkbox: typeof Checkbox; Radio: typeof Radio; Switch: typeof Switch;
      Segmented: typeof Segmented; Tabs: typeof Tabs; Nav: typeof Nav; Footer: typeof Footer; Hero: typeof Hero;
      SectionHeading: typeof SectionHeading; Card: typeof Card; Rule: typeof Rule; Table: typeof Table; Avatar: typeof Avatar;
      AvatarGroup: typeof AvatarGroup; Code: typeof Code; CodeBlock: typeof CodeBlock; Alert: typeof Alert; Dialog: typeof Dialog;
      Photo: typeof Photo; Icon: typeof Icon; Reveal: typeof Reveal; Loader: typeof Loader; ICON_NAMES: IconName[];
    };
  }
}

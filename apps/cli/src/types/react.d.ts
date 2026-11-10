/**
 * apps/cli/src/types/react.d.ts
 *
 * Ambient React 19 type declarations for JSX and React hooks in OpenTUI.
 */

declare module "react" {
  export type ReactNode =
    | string
    | number
    | boolean
    | null
    | undefined
    | ReactElement<any, any>
    | Iterable<ReactNode>;

  export type Key = string | number | bigint;

  export interface ReactElement<P = any, T extends string | JSXElementConstructor<any> = string | JSXElementConstructor<any>> {
    type: T;
    props: P;
    key: Key | null;
  }

  export type JSXElementConstructor<P> =
    | ((props: P) => ReactNode)
    | (new (props: P) => Component<any, any>);

  export interface Attributes {
    key?: Key | null | undefined;
  }

  export interface ClassAttributes<T> extends Attributes {
    ref?: Ref<T> | undefined;
  }

  export type Ref<T> = RefCallback<T> | RefObject<T> | null;
  export type RefCallback<T> = { bivarianceHack(instance: T | null): void }["bivarianceHack"];
  export interface RefObject<T> {
    readonly current: T | null;
  }

  export class Component<P = {}, S = {}, SS = any> {
    constructor(props: P);
    state: Readonly<S>;
    props: Readonly<P>;
    render(): ReactNode;
    setState(state: any, callback?: () => void): void;
  }

  export interface Context<T> {
    Provider: (props: { value: T; children?: ReactNode }) => ReactElement<any, any>;
    Consumer: (props: { children: (value: T) => ReactNode }) => ReactElement<any, any>;
    displayName?: string;
  }

  export function createContext<T>(defaultValue: T): Context<T>;
  export function useContext<T>(context: Context<T>): T;
  export function useState<T>(initialState: T | (() => T)): [T, (value: T | ((prev: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  export function useLayoutEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  export function useMemo<T>(factory: () => T, deps: readonly any[] | undefined): T;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: readonly any[]): T;
  export function useRef<T>(initialValue: T): { current: T };
  export function useRef<T = undefined>(): { current: T | undefined };

  export function createElement(type: any, props?: any, ...children: any[]): ReactElement;
  export function Fragment(props: { children?: ReactNode }): ReactElement;

  namespace JSX {
    interface Element extends ReactElement<any, any> {}
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }

  const React: {
    createContext: typeof createContext;
    useContext: typeof useContext;
    useState: typeof useState;
    useEffect: typeof useEffect;
    useLayoutEffect: typeof useLayoutEffect;
    useMemo: typeof useMemo;
    useCallback: typeof useCallback;
    useRef: typeof useRef;
    createElement: typeof createElement;
    Fragment: typeof Fragment;
    Component: typeof Component;
  };

  export default React;
}

declare module "react/jsx-runtime" {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare module "react/jsx-dev-runtime" {
  export const jsxDEV: any;
  export const Fragment: any;
}

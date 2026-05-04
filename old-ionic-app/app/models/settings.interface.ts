export enum TabType {
  'View',
  'Action',
}

export interface DashboardView {
  id: string;
  title: string;
  widgets: string[];
}

export interface DashboardTab {
  id: string;
  icon: string;
  type: TabType;
  view: string | undefined;
  action: string | undefined;
  weight: number;
  enabled: boolean;
}

export interface Settings {
  widgets: string[];
  views: DashboardView[];
  tabs: DashboardTab[];
}

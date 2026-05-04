export interface WidgetInterface {
  id: string;
  property_id: string;
  widget_id: string;
  data: any;
}

export interface WidgetDisplay {
  url: string;
  size: string;
  widget: any;
  icon?: string;
  iconBg?: string;
  buttonBg?: string;
  data?: any;
}

export interface Widget {
  title: string;
  path: string;
  widget: WidgetDisplay;
  page: any;
}

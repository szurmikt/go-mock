export interface InfoModalInterface {
  headerImage?: string;
  headerIcon?: string;
  headerTitle?: string;
  closeBtn?: boolean;
  contentTitle: string;
  contentDescription: string;
  contentImage?: string;
  buttons?: {
    style: string;
    text: string;
    img?: string;
    icon?: string;
    handler: any;
  }[]
}

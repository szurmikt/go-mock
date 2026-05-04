export class Config {
  public static readonly APP_ID = 'com.sabeeapp.go';
  public static readonly API_VERSION = '1.0';
  public static readonly APP_VERSION = '1.1.0';
  public static readonly APP_BUILD = '2512041';
  public static readonly CI_VERSION = '4';
  public static readonly API_URL = '';
  public static readonly API_URL_XANO =
    'https://x8ki-letl-twmt.n7.xano.io/api:';
  public static readonly DEV_API_URL = 'https://smart.sabeeapp.com/api2/go';
  public static readonly DEV_API_URL_XANO =
    'https://x8ki-letl-twmt.n7.xano.io/api:';
  // public static readonly DEV_API_URL = 'http://192.168.69.204/test/api2/fom/';
  public static readonly API_CHANGE_TIMEOUT = 5; // in seconds
  public static readonly API_CHANGE_PASSWORD = 'nosuccesswithoutfailure';
  public static IS_DEV = true;
  public static readonly SHOULD_LOG = !Config.IS_DEV;
  public static readonly IS_VIRTUAL = false;
  // public static readonly CHECK_REGULA_DB_INTERVAL = 604800000; // 7 days
  public static readonly CHECK_REGULA_DB_INTERVAL = 1; // 7 days

  public static readonly ID_CARDS = [
    12, 16, 20, 28, 75, 76, 77, 83, 97, 98, 106, 121, 159, 160, 161, 162, 177,
    212, 213, 216, 224, 225,
  ];
  public static readonly PASSPORTS = [
    11, 13, 14, 17, 26, 27, 172, 179, 198, 199, 200, 201, 202, 203, 204, 218,
  ];
  public static readonly DRIVING_LICENCES = [
    36, 37, 38, 39, 40, 41, 46, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59,
    60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 80, 81, 82, 84,
    85, 86, 87, 88, 89, 105, 107, 108, 109, 110, 112, 113, 114, 115, 116, 117,
    118, 119, 120, 126, 127, 132, 134, 135, 136, 138, 139, 140, 148, 149, 156,
    157, 158, 163, 164, 165, 169, 170, 171, 176, 187, 234, 235,
  ];
}

import {
  Login, Signup, ForgotPassword, Splash, Introduction,
  About, Profile, Settings, Logout, Home,
  PrivacyPolicy, TermsCondition, OTPVerification
} from '../screens';

export const Screens: any = {
  Splash,
  Introduction,
  Login,
  Signup,
  ForgotPassword,
  OTPVerification,
  Profile,
  About,
  Settings,
  Logout,
  Home,
  PrivacyPolicy,
  TermsCondition,
};

export const NavIcons = {
  home: { focused: 'home', unfocused: 'home-outline' },
  profile: { focused: 'account', unfocused: 'account-outline' },
  settings: { focused: 'cog', unfocused: 'cog-outline' },
  about: { focused: 'information', unfocused: 'information-outline' },
  privacy: { focused: 'shield-check', unfocused: 'shield-check-outline' },
  terms: { focused: 'file-document', unfocused: 'file-document-outline' },
  logout: { focused: 'logout', unfocused: 'logout' },
};

export const getNavIcon = (name: keyof typeof NavIcons) => NavIcons[name];

export const NavConfig: any = {
  public: {
    type: 'stack',
    screens: [
      {
        name: 'Login',
        options: { headerShown: false },
      },
      {
        name: 'Signup',
        label: 'Create Account',
        options: {
          title: 'Create Account',
          headerShown: false,
        },
      },
      {
        name: 'ForgotPassword',
        label: 'Reset Password',
        options: {
          title: 'Recover Password',
          headerShown: false,
        },
      },
      {
        name: 'OTPVerification',
        label: 'OTP Verification',
        options: {
          title: 'Verification',
          headerShown: false,
        },
      },
    ],
  },


  protected: {
    type: 'drawer',
    showDrawer: true,
    showBottomTabs: true,
    screens: [
      {
        name: 'Home',
        label: 'Home',
        icon: getNavIcon('home'),
        options: { headerShown: false },

        subNavigator: {
          type: 'tabs',
          screens: [
            {
              name: 'Home',
              label: 'Home',
              icon: getNavIcon('home'),
              options: { headerShown: false },
            },
            {
              name: 'Profile',
              label: 'Profile',
              icon: getNavIcon('profile'),
              options: { headerShown: false },
            },
            {
              name: 'About',
              label: 'About',
              icon: getNavIcon('about'),
              options: { headerShown: false },
            },
          ],
        },
      },
      {
        name: 'Settings',
        label: 'Settings',
        icon: getNavIcon('settings'),
        options: { headerShown: false },
      },
      {
        name: 'PrivacyPolicy_Drawer',
        componentName: 'PrivacyPolicy',
        label: 'Privacy Policy',
        icon: getNavIcon('privacy'),
        options: { headerShown: false },
      },
      {
        name: 'TermsCondition_Drawer',
        componentName: 'TermsCondition',
        label: 'Terms & Conditions',
        icon: getNavIcon('terms'),
        options: { headerShown: false },
      },
    ],
  },

  shared: [
    {
      name: 'PrivacyPolicy',
      options: {
        title: 'Privacy Policy',
        presentation: 'modal',
      },
    },
    {
      name: 'TermsCondition',
      options: {
        title: 'Terms & Conditions',
        presentation: 'modal',
      },
    },
  ],
};

export const getScreenComponent = (
  name: string
): React.ComponentType<any> | null => {
  return Screens[name.replace('_Drawer', '')] || null;
};
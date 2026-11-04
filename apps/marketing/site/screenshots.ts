import activityDark from "../../../docs/images/activity-dark.png";
import activityLight from "../../../docs/images/activity-light.png";
import browserDark from "../../../docs/images/browser-dark.png";
import browserLight from "../../../docs/images/browser-light.png";
import comparisonDark from "../../../docs/images/comparison-dark.png";
import comparisonLight from "../../../docs/images/comparison-light.png";
import cloudDark from "../../../docs/images/connections-cloud-dark.png";
import cloudLight from "../../../docs/images/connections-cloud-light.png";
import localDark from "../../../docs/images/connections-local-dark.png";
import localLight from "../../../docs/images/connections-local-light.png";
import remoteDark from "../../../docs/images/connections-remote-dark.png";
import remoteLight from "../../../docs/images/connections-remote-light.png";
import policiesDark from "../../../docs/images/policies-dark.png";
import policiesLight from "../../../docs/images/policies-light.png";
import restoreDark from "../../../docs/images/restore-dark.png";
import restoreLight from "../../../docs/images/restore-light.png";
import vaultDark from "../../../docs/images/vault-dark.png";
import vaultLight from "../../../docs/images/vault-light.png";

export const screenshots = {
  vault: { light: vaultLight, dark: vaultDark },
  comparison: { light: comparisonLight, dark: comparisonDark },
  activity: { light: activityLight, dark: activityDark },
  browser: { light: browserLight, dark: browserDark },
  policies: { light: policiesLight, dark: policiesDark },
  restore: { light: restoreLight, dark: restoreDark },
  local: { light: localLight, dark: localDark },
  cloud: { light: cloudLight, dark: cloudDark },
  remote: { light: remoteLight, dark: remoteDark },
};

export type ScreenshotName = keyof typeof screenshots;

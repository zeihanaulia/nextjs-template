import ReactGA from "react-ga4";

export enum GAType {
  G4A = "G4A",
  NONE = "NONE",
}

export const initGA = async (gaTrackingId: string, _gaType: GAType) => {
  ReactGA.initialize(gaTrackingId);
};

export const logPageView = (_gaType: GAType) => {
  ReactGA.send("pageview");
};

export const logEvent = (category = "", action = "") =>
  ReactGA.event({ category, action });

export const logException = (description = "", _fatal = false) =>
  ReactGA.event({ category: "exception", action: description });

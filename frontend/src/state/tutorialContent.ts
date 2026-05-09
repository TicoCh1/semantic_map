export type TutorialPage = {
  eyebrow: string;
  title: string;
  body: string;
  items: string[];
  target: "prompt" | "layers" | "histogram" | "style" | "map" | "street-view";
};

export const TUTORIAL_PAGES: TutorialPage[] = [
  {
    eyebrow: "Start",
    title: "Search street-view impressions with statements",
    body: "UrbanFabric maps how strongly street-view scenes match a visual impression, so you can compare that impression across London and Shanghai. When both cities are visible, the map scales will be locked in synchronization for better map reading.",
    items: [
      "Type any visual statement about the scene, not a question.",
      "Use prompts like `the street feels enclosed by tall buildings` or `the scene contains active shopfronts`.",
      "Submit the prompt to create a map layer showing where that statement is stronger or weaker."
    ],
    target: "prompt"
  },
  {
    eyebrow: "Cities",
    title: "Control London and Shanghai views",
    body: "The two map panes let you compare the same prompt between cities or focus on one city at a time.",
    items: [
      "Use the London and Shanghai checkboxes in the map toolbar to show or hide each city.",
      "When both cities are visible, the map scales will be locked in synchronization for better map reading.",
      "Drag the divider between the two maps to give more space to the city you are inspecting."
    ],
    target: "map"
  },
  {
    eyebrow: "Layers",
    title: "Compare several impressions as layers",
    body: "Each submitted statement becomes a layer that you can keep, hide, reorder, refresh, or delete.",
    items: [
      "Create multiple layers to compare different visual feelings or objects.",
      "Toggle layers on and off to isolate one prompt or compare it against another.",
      "Drag layers to choose which one appears on top when points overlap."
    ],
    target: "layers"
  },
  {
    eyebrow: "Score and style",
    title: "Tune the range for each prompt",
    body: "Different prompts often need different score ranges and styling before the pattern becomes readable.",
    items: [
      "For very specific prompts, raise both Min and Max range to focus on only the strongest matches.",
      "For general or conceptual prompts, lower both Min and Max range so softer matches are still visible.",
      "Pick a colour ramp and point size that make the selected layer readable after the range is set."
    ],
    target: "histogram"
  },
  {
    eyebrow: "Map",
    title: "Navigate and inspect the comparison",
    body: "Use normal map navigation to move through each city, then turn on more detail only when you need a closer look.",
    items: [
      "Pan and zoom either city; when two cities are visible, the other pane follows the same ground scale.",
      "Change the basemap when streets, satellite imagery, or dark background makes the pattern easier to read.",
      "Use Max detail for close inspection, but turn it off for smoother large-area browsing."
    ],
    target: "map"
  },
  {
    eyebrow: "Street view",
    title: "Check the actual panorama behind a point",
    body: "The map shows scores, but the street-view panel lets you verify what the camera actually saw.",
    items: [
      "Click a scored point to mark its panorama location.",
      "Use the marked pano list to switch between places you want to compare.",
      "Read the selected pano's layer values while visually checking the street scene."
    ],
    target: "street-view"
  }
];

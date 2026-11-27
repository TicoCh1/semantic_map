import { ThemedSelect } from "./ThemedSelect";

export type Workspace = "cities" | "atlas" | "tsne";
type View = Workspace | "embeddings" | "difference";
export function WorkspaceSelect({ value, onChange, comparisons = false }: {
  value: View; onChange: (view: View) => void; comparisons?: boolean;
}) {
  return <label className="basemap-select comparison-mode-select">
    <span>View</span>
    <ThemedSelect label="Map comparison mode" value={value} onValueChange={v => onChange(v as View)}>
      <option value="cities">Semantic query</option>
      <option value="atlas">Boundary query</option>
      <option value="tsne">t-SNE</option>
      {comparisons && <option value="embeddings">Old vs new embedding</option>}
      {comparisons && <option value="difference">Difference mode</option>}
    </ThemedSelect>
  </label>;
}


 // Pembaca katalog Playbook dan relasi problem labels dari Supabase.
 // Seluruh data dibaca dari database, tanpa katalog hardcoded.

export async function loadPlaybookCatalog(supabase) {
  const columns = [
    "id", "title", "problem_type", "categories", "business_stage",
    "when_to_use", "when_not_to_use", "summary",
    "step_1", "step_2", "step_3", "step_4",
    "step_5", "step_6", "step_7",
    "cost_level", "cost_note", "cost_estimated",
    "time_needed", "skill_needed", "team_size",
    "metric", "risks", "source",
  ].join(",");

  const all = [];
  const pageSize = 500;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("playbooks")
      .select(`
        ${columns},
        playbook_problem_labels (
          problem_labels (
            id,
            name
          )
        )
      `)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      console.error("Gagal membaca katalog Playbook:", error);
      throw new Error("Gagal membaca katalog Playbook.");
    }

    all.push(...(data ?? []));

    if (!data || data.length < pageSize) break;
  }

  return all.map((playbook) => {
    const relations = playbook.playbook_problem_labels ?? [];

    const labels = relations
      .map((relation) => relation.problem_labels)
      .filter((label) => label && label.id);

    return {
      ...playbook,
      labels,
      problem_labels: [...new Set(labels.map((label) => label.id))],
      playbook_problem_labels: undefined,
    };
  });
}

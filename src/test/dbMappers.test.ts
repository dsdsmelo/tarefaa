import { describe, expect, it } from "vitest";
import { milestoneToDb, personToDb, phaseToDb, projectToDb, taskToDb, cellToDb, withCustomValue } from "@/lib/dbMappers";

describe("limpar campos grava null (Etapa 4, item 5)", () => {
  it("tarefa: datas, descrição, fase, observação e campos novos limpos viram null", () => {
    const row = taskToDb({
      endDate: undefined, startDate: "", description: "  ", phaseId: undefined, observation: "",
      sprintDate: undefined, plannedDate: null, estimateMinutes: null, quantity: undefined,
      waitingOnPersonId: undefined, waitingOnText: "", followUpDate: undefined,
    });
    expect(row).toEqual({
      end_date: null, start_date: null, description: null, phase_id: null, observation: null,
      sprint_date: null, planned_date: null, estimate_minutes: null, quantity: null,
      waiting_on_person_id: null, waiting_on_text: null, follow_up_date: null,
    });
  });

  it("tarefa: responsáveis vazios gravam null e zeram o responsible_id antigo", () => {
    expect(taskToDb({ responsibleIds: undefined })).toEqual({ responsible_ids: null, responsible_id: null });
    expect(taskToDb({ responsibleIds: [] })).toEqual({ responsible_ids: null, responsible_id: null });
    expect(taskToDb({ responsibleIds: ["p1"] })).toEqual({ responsible_ids: ["p1"], responsible_id: null });
  });

  it("tarefa: chave ausente não é enviada (não mexe)", () => {
    expect(taskToDb({ status: "completed" })).toEqual({ status: "completed" });
    expect(taskToDb({})).toEqual({});
  });

  it("tarefa: campos obrigatórios nunca viram null", () => {
    expect(taskToDb({ name: undefined, status: undefined, priority: undefined, projectId: undefined })).toEqual({});
  });

  it("tarefa: valores preenchidos passam como estão", () => {
    expect(taskToDb({ endDate: "2026-11-10", description: "x", estimateMinutes: 30 }))
      .toEqual({ end_date: "2026-11-10", description: "x", estimate_minutes: 30 });
  });

  it("tarefa: custom_values vazio grava {}", () => {
    expect(taskToDb({ customValues: undefined })).toEqual({ custom_values: {} });
  });

  it("projeto: descrição, datas, capa e campos da saúde", () => {
    expect(projectToDb({ description: undefined, startDate: "", endDate: undefined, coverColor: null, imageUrl: undefined, healthOverride: null, nextActionTaskId: undefined }))
      .toEqual({ description: null, start_date: null, end_date: null, cover_color: null, image_url: null, health_override: null, next_action_task_id: null });
    expect(projectToDb({ name: undefined, status: undefined, workspaceId: undefined })).toEqual({});
  });

  it("fase e marco: descrição, cor e fase limpas", () => {
    expect(phaseToDb({ description: "", color: undefined, startDate: undefined })).toEqual({ description: null, color: null, start_date: null });
    expect(milestoneToDb({ phaseId: undefined, description: "" })).toEqual({ phase_id: null, description: null });
    expect(milestoneToDb({ date: undefined, name: undefined })).toEqual({});
  });

  it("pessoa: e-mail, sobrenome, foto e workspace limpos; vínculo de conta nunca zera", () => {
    expect(personToDb({ email: undefined, lastName: "", avatarUrl: null, workspaceId: null }))
      .toEqual({ email: null, last_name: null, avatar_url: null, workspace_id: null });
    expect(personToDb({ authUserId: undefined, name: undefined })).toEqual({});
  });

  it("célula: descrição limpa", () => {
    expect(cellToDb({ description: undefined })).toEqual({ description: null });
  });

  it("campo personalizado: vazio remove a chave", () => {
    expect(withCustomValue({ a: "x", b: 2 }, "a", "")).toEqual({ b: 2 });
    expect(withCustomValue({ a: "x" }, "a", "  ")).toEqual({});
    expect(withCustomValue(undefined, "a", null)).toEqual({});
    expect(withCustomValue({ a: "x" }, "b", 0)).toEqual({ a: "x", b: 0 });
    expect(withCustomValue({ a: "x" }, "a", "y")).toEqual({ a: "y" });
  });
});

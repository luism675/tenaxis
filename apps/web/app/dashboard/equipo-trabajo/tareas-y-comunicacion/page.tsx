"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/components/ui/utils";
import { useUserRole } from "@/hooks/use-user-role";
import {
  teamTasksClient,
  type TeamTask,
  type TeamTaskDueFilter,
  type TeamTaskFilters,
  type TeamTaskPagination,
  type TeamTaskPerson,
  type TeamTaskStatus,
  type TeamTaskSummary,
} from "@/lib/api/team-tasks-client";

type TaskFormState = {
  titulo: string;
  descripcion: string;
  observaciones: string;
  responsableMembershipId: string;
  fechaLimite: string;
};

const STATUS_ORDER: TeamTaskStatus[] = [
  "PENDIENTE",
  "EN_PROGRESO",
  "BLOQUEADA",
  "COMPLETADA",
  "CANCELADA",
];

const STATUS_META: Record<
  TeamTaskStatus,
  {
    label: string;
    description: string;
    badgeClass: string;
    columnClass: string;
    dotClass: string;
    countClass: string;
  }
> = {
  PENDIENTE: {
    label: "Pendiente",
    description: "Asignada, esperando inicio.",
    badgeClass: "border-border bg-muted text-muted-foreground",
    columnClass: "border-border bg-card",
    dotClass: "bg-slate-400",
    countClass: "bg-muted text-muted-foreground",
  },
  EN_PROGRESO: {
    label: "En progreso",
    description: "El responsable ya la está trabajando.",
    badgeClass: "border-sky-200 bg-sky-50 text-sky-700",
    columnClass: "border-border bg-card",
    dotClass: "bg-[#01ADFB]",
    countClass: "border-sky-200 bg-sky-50 text-sky-700",
  },
  BLOQUEADA: {
    label: "Bloqueada",
    description: "Necesita desbloqueo o decisión.",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
    columnClass: "border-border bg-card",
    dotClass: "bg-amber-500",
    countClass: "border-amber-200 bg-amber-50 text-amber-700",
  },
  COMPLETADA: {
    label: "Completada",
    description: "Cerrada correctamente.",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    columnClass: "border-border bg-card",
    dotClass: "bg-emerald-500",
    countClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  CANCELADA: {
    label: "Cancelada",
    description: "No se continuará ejecutando.",
    badgeClass: "border-border bg-muted text-muted-foreground",
    columnClass: "border-border bg-card",
    dotClass: "bg-muted-foreground",
    countClass: "bg-muted text-muted-foreground",
  },
};

const STATUS_OPTIONS = STATUS_ORDER.map((status) => ({
  value: status,
  label: STATUS_META[status].label,
  searchText: STATUS_META[status].description,
}));

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "Todos los estados", searchText: "todos" },
  ...STATUS_OPTIONS,
];

const DUE_FILTER_OPTIONS = [
  { value: "", label: "Todos los vencimientos", searchText: "todos" },
  { value: "vencidas", label: "Vencidas", searchText: "atrasadas vencidas" },
  { value: "hoy", label: "Vencen hoy", searchText: "hoy dia actual" },
  { value: "semana", label: "Próximos 7 días", searchText: "semana próximos" },
];

const EMPTY_SUMMARY: TeamTaskSummary = {
  total: 0,
  vencidas: 0,
  byStatus: {
    PENDIENTE: 0,
    EN_PROGRESO: 0,
    BLOQUEADA: 0,
    COMPLETADA: 0,
    CANCELADA: 0,
  },
};

const EMPTY_FORM: TaskFormState = {
  titulo: "",
  descripcion: "",
  observaciones: "",
  responsableMembershipId: "",
  fechaLimite: "",
};

const TASKS_PAGE_SIZE = 10;

const EMPTY_PAGINATION: TeamTaskPagination = {
  page: 1,
  limit: TASKS_PAGE_SIZE,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
};

const buildEmptyColumnPagination = () =>
  STATUS_ORDER.reduce(
    (acc, status) => ({
      ...acc,
      [status]: EMPTY_PAGINATION,
    }),
    {} as Record<TeamTaskStatus, TeamTaskPagination>,
  );

const CONTROL_CLASS =
  "h-9 rounded-[5px] border border-border bg-background px-3 text-xs font-medium text-foreground shadow-none transition-colors placeholder:text-muted-foreground focus-visible:border-[#01ADFB] focus-visible:ring-2 focus-visible:ring-[#01ADFB]/15";

const SELECT_CLASS = cn(
  CONTROL_CLASS,
  "pr-9 normal-case tracking-normal",
);

const BOARD_CONTROL_CLASS =
  "h-9 rounded-[5px] border border-border bg-background px-3 text-xs font-medium text-foreground shadow-none transition-colors placeholder:text-muted-foreground focus-visible:border-[#01ADFB] focus-visible:ring-2 focus-visible:ring-[#01ADFB]/15";

const BOARD_SELECT_CLASS = cn(
  BOARD_CONTROL_CLASS,
  "pr-9 normal-case tracking-normal",
);

const TEXTAREA_CLASS = cn(
  "rounded-[5px] border border-border bg-background px-3 py-2 text-xs font-medium text-foreground shadow-none transition-colors placeholder:text-muted-foreground focus-visible:border-[#01ADFB] focus-visible:ring-2 focus-visible:ring-[#01ADFB]/15",
);

const LABEL_CLASS =
  "text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground";

const formatDate = (value?: string | null) => {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Bogota",
  }).format(new Date(value));
};

const toDateInputValue = (value?: string | null) => {
  if (!value) return "";
  return value.slice(0, 10);
};

const isTaskOverdue = (task: TeamTask) => {
  if (
    !task.fechaLimite ||
    task.estado === "COMPLETADA" ||
    task.estado === "CANCELADA"
  ) {
    return false;
  }
  return new Date(task.fechaLimite).getTime() < Date.now();
};

const getBogotaDateKey = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Bogota",
    year: "numeric",
  }).format(date);

const matchesDueFilter = (
  task: TeamTask,
  vencimiento?: TeamTaskDueFilter,
) => {
  if (!vencimiento) return true;
  if (!task.fechaLimite) return false;

  const dueDate = new Date(task.fechaLimite);

  if (vencimiento === "vencidas") {
    return isTaskOverdue(task);
  }

  if (vencimiento === "hoy") {
    return getBogotaDateKey(dueDate) === getBogotaDateKey(new Date());
  }

  const todayKey = getBogotaDateKey(new Date());
  const sevenDaysKey = getBogotaDateKey(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  );
  const dueKey = getBogotaDateKey(dueDate);

  return dueKey >= todayKey && dueKey <= sevenDaysKey;
};

const taskMatchesFilters = (task: TeamTask, filters: TeamTaskFilters) => {
  if (filters.estado && task.estado !== filters.estado) return false;
  if (
    filters.responsableMembershipId &&
    task.responsable?.id !== filters.responsableMembershipId
  ) {
    return false;
  }

  if (!matchesDueFilter(task, filters.vencimiento)) return false;

  const search = filters.search?.trim().toLowerCase();
  if (search) {
    const searchableText = [
      task.titulo,
      task.descripcion,
      task.observaciones,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (!searchableText.includes(search)) return false;
  }

  return true;
};

const applyTaskSummaryDelta = (
  current: TeamTaskSummary,
  task: TeamTask,
  direction: 1 | -1,
): TeamTaskSummary => ({
  total: Math.max(0, current.total + direction),
  vencidas: Math.max(
    0,
    current.vencidas + (isTaskOverdue(task) ? direction : 0),
  ),
  byStatus: {
    ...current.byStatus,
    [task.estado]: Math.max(
      0,
      (current.byStatus[task.estado] ?? 0) + direction,
    ),
  },
});

const reconcileTaskInCurrentView = (
  current: TeamTask[],
  updatedTask: TeamTask,
  filters: TeamTaskFilters,
) => {
  const shouldShow = taskMatchesFilters(updatedTask, filters);
  const exists = current.some((row) => row.id === updatedTask.id);

  if (!shouldShow) {
    return current.filter((row) => row.id !== updatedTask.id);
  }

  if (!exists) {
    return [updatedTask, ...current];
  }

  return current.map((row) => (row.id === updatedTask.id ? updatedTask : row));
};

const mergeUniqueTasks = (current: TeamTask[], incoming: TeamTask[]) => {
  const byId = new Map(current.map((task) => [task.id, task]));
  incoming.forEach((task) => byId.set(task.id, task));
  return Array.from(byId.values());
};

export default function TeamTasksCommunicationPage() {
  const {
    role,
    isGlobalSuAdmin,
    isLoading: isLoadingRole,
    checkPermission,
  } = useUserRole();
  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [summary, setSummary] = useState<TeamTaskSummary>(EMPTY_SUMMARY);
  const [columnPagination, setColumnPagination] = useState<
    Record<TeamTaskStatus, TeamTaskPagination>
  >(buildEmptyColumnPagination);
  const [assignees, setAssignees] = useState<TeamTaskPerson[]>([]);
  const [filters, setFilters] = useState<TeamTaskFilters>({});
  const [searchDraft, setSearchDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMoreStatus, setLoadingMoreStatus] =
    useState<TeamTaskStatus | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TeamTask | null>(null);
  const [form, setForm] = useState<TaskFormState>(EMPTY_FORM);

  const canView =
    !!isGlobalSuAdmin ||
    checkPermission("TEAM_VIEW") ||
    role === "ASESOR" ||
    role === "OPERADOR";
  const canManage =
    !!isGlobalSuAdmin || checkPermission("TEAM_CREATE") || role === "ASESOR";
  const canDelete = !!isGlobalSuAdmin || checkPermission("TEAM_DELETE");

  const assigneeOptions = useMemo(
    () =>
      assignees.map((assignee) => ({
        value: assignee.id,
        label: `${assignee.name} · ${assignee.role}`,
        searchText: `${assignee.email} ${assignee.role}`,
      })),
    [assignees],
  );

  const visibleStatuses = useMemo(
    () => (filters.estado ? [filters.estado] : STATUS_ORDER),
    [filters.estado],
  );

  const loadData = useCallback(async () => {
    if (!canView) return;
    setIsLoading(true);
    setError(null);

    try {
      const [taskResponses, assigneeRows] = await Promise.all([
        Promise.all(
          visibleStatuses.map((status) =>
            teamTasksClient.getAll({
              ...filters,
              estado: status,
              page: 1,
              limit: TASKS_PAGE_SIZE,
            }),
          ),
        ),
        teamTasksClient.getAssignees(),
      ]);
      setTasks(taskResponses.flatMap((response) => response.items));
      setSummary(taskResponses[0]?.summary ?? EMPTY_SUMMARY);
      setColumnPagination(() => {
        const next = buildEmptyColumnPagination();
        visibleStatuses.forEach((status, index) => {
          next[status] = taskResponses[index]?.pagination ?? EMPTY_PAGINATION;
        });
        return next;
      });
      setAssignees(assigneeRows);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "No se pudieron cargar las tareas del equipo";
      setError(message);
      toast.error(message);
      setTasks([]);
      setSummary(EMPTY_SUMMARY);
      setColumnPagination(buildEmptyColumnPagination());
      setAssignees([]);
    } finally {
      setIsLoading(false);
    }
  }, [canView, filters, visibleStatuses]);

  useEffect(() => {
    if (!isLoadingRole) {
      if (canView) {
        loadData();
      } else {
        setIsLoading(false);
      }
    }
  }, [canView, isLoadingRole, loadData]);

  const openCreateDialog = () => {
    setEditingTask(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (task: TeamTask) => {
    setEditingTask(task);
    setForm({
      titulo: task.titulo,
      descripcion: task.descripcion ?? "",
      observaciones: task.observaciones ?? "",
      responsableMembershipId: task.responsable?.id ?? "",
      fechaLimite: toDateInputValue(task.fechaLimite),
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.titulo.trim()) {
      toast.error("El título es obligatorio");
      return;
    }

    setIsSaving(true);
    try {
      if (editingTask) {
        const updatedTask = await teamTasksClient.update(editingTask.id, {
          titulo: form.titulo,
          descripcion: form.descripcion,
          observaciones: form.observaciones,
          responsableMembershipId: form.responsableMembershipId || null,
          fechaLimite: form.fechaLimite || null,
        });
        setTasks((current) =>
          reconcileTaskInCurrentView(current, updatedTask, filters),
        );
        setSummary((current) => {
          let next = current;
          if (taskMatchesFilters(editingTask, filters)) {
            next = applyTaskSummaryDelta(next, editingTask, -1);
          }
          if (taskMatchesFilters(updatedTask, filters)) {
            next = applyTaskSummaryDelta(next, updatedTask, 1);
          }
          return next;
        });
        toast.success("Tarea actualizada");
      } else {
        const createdTask = await teamTasksClient.create({
          titulo: form.titulo,
          descripcion: form.descripcion,
          observaciones: form.observaciones,
          responsableMembershipId: form.responsableMembershipId || null,
          fechaLimite: form.fechaLimite || undefined,
        });
        if (taskMatchesFilters(createdTask, filters)) {
          setTasks((current) => [createdTask, ...current]);
          setSummary((current) =>
            applyTaskSummaryDelta(current, createdTask, 1),
          );
        }
        toast.success("Tarea creada");
      }

      setDialogOpen(false);
      setEditingTask(null);
      setForm(EMPTY_FORM);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo guardar la tarea",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (task: TeamTask, estado: TeamTaskStatus) => {
    if (task.estado === estado) return;

    const previousTasks = tasks;
    const previousSummary = summary;
    const optimisticTask = { ...task, estado };

    setTasks((current) =>
      reconcileTaskInCurrentView(current, optimisticTask, filters),
    );
    setSummary((current) => {
      let next = current;
      if (taskMatchesFilters(task, filters)) {
        next = applyTaskSummaryDelta(next, task, -1);
      }
      if (taskMatchesFilters(optimisticTask, filters)) {
        next = applyTaskSummaryDelta(next, optimisticTask, 1);
      }
      return next;
    });

    try {
      const updatedTask = await teamTasksClient.changeStatus(task.id, estado);
      setTasks((current) =>
        reconcileTaskInCurrentView(current, updatedTask, filters),
      );
      setSummary((current) => {
        let next = current;
        if (taskMatchesFilters(optimisticTask, filters)) {
          next = applyTaskSummaryDelta(next, optimisticTask, -1);
        }
        if (taskMatchesFilters(updatedTask, filters)) {
          next = applyTaskSummaryDelta(next, updatedTask, 1);
        }
        return next;
      });
      toast.success(
        `Tarea movida a ${STATUS_META[estado].label.toLowerCase()}`,
      );
    } catch (err) {
      setTasks(previousTasks);
      setSummary(previousSummary);
      toast.error(
        err instanceof Error ? err.message : "No se pudo cambiar el estado",
      );
    }
  };

  const handleDelete = async (task: TeamTask) => {
    if (!confirm(`¿Archivar la tarea "${task.titulo}"?`)) return;

    try {
      await teamTasksClient.delete(task.id);
      toast.success("Tarea archivada");
      await loadData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo archivar la tarea",
      );
    }
  };

  const handleLoadMore = async (status: TeamTaskStatus) => {
    const pagination = columnPagination[status];
    if (!pagination?.hasNextPage || loadingMoreStatus) return;

    setLoadingMoreStatus(status);
    try {
      const response = await teamTasksClient.getAll({
        ...filters,
        estado: status,
        page: pagination.page + 1,
        limit: pagination.limit || TASKS_PAGE_SIZE,
      });
      setTasks((current) => mergeUniqueTasks(current, response.items));
      setSummary(response.summary);
      setColumnPagination((current) => ({
        ...current,
        [status]: response.pagination,
      }));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudieron cargar más tareas",
      );
    } finally {
      setLoadingMoreStatus(null);
    }
  };

  const applySearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters((current) => ({
      ...current,
      search: searchDraft.trim() || undefined,
    }));
  };

  if (isLoadingRole || isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-[70vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#01ADFB]" />
        </div>
      </DashboardLayout>
    );
  }

  if (!canView) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-3xl rounded-[6px] border border-amber-200 bg-amber-50 p-5 text-sm font-medium text-amber-900">
          No tenés permisos para ver tareas del equipo.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1600px]">
        <section className="overflow-hidden rounded-[6px] border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[5px] border border-border bg-muted text-muted-foreground">
                <CalendarClock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#01ADFB]">
                  Equipo de trabajo
                </p>
                <h1 className="mt-1 text-base font-medium tracking-[-0.01em] text-foreground">
                  Tareas y comunicación
                </h1>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                  Asigná responsables, controlá vencimientos y seguí cada tarea
                  por estado para mantener al equipo alineado.
                </p>
              </div>
            </div>

            {canManage ? (
              <Button
                type="button"
                onClick={openCreateDialog}
                className="h-8 rounded-[5px] bg-[#01ADFB] px-3 text-xs font-medium text-white shadow-none hover:bg-[#0198dc]"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Nueva tarea
              </Button>
            ) : null}
          </div>

          <div className="grid border-b border-border md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Pendientes"
              value={summary.byStatus.PENDIENTE}
              tone="slate"
            />
            <KpiCard
              label="En progreso"
              value={summary.byStatus.EN_PROGRESO}
              tone="sky"
            />
            <KpiCard
              label="Bloqueadas"
              value={summary.byStatus.BLOQUEADA}
              tone="amber"
            />
            <KpiCard label="Vencidas" value={summary.vencidas} tone="rose" />
          </div>

          <div className="border-b border-border px-5 py-3">
            <div className="grid gap-2 xl:grid-cols-[minmax(360px,1fr)_minmax(0,720px)] xl:items-center">
              <form
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2"
                onSubmit={applySearch}
              >
                <div className="relative min-w-0">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchDraft}
                    onChange={(event) => setSearchDraft(event.target.value)}
                    placeholder="Buscar por título, descripción u observaciones..."
                    className={cn(BOARD_CONTROL_CLASS, "pl-8")}
                  />
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  className="h-9 rounded-[5px] border-border bg-background px-3 text-xs font-medium text-muted-foreground shadow-none hover:bg-muted hover:text-foreground"
                >
                  Buscar
                </Button>
              </form>

              <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <Combobox
                    value={filters.estado ?? ""}
                    onChange={(value) =>
                      setFilters((current) => ({
                        ...current,
                        estado: (value || undefined) as
                          | TeamTaskStatus
                          | undefined,
                      }))
                    }
                    options={STATUS_FILTER_OPTIONS}
                    placeholder="Filtrar por estado"
                    triggerClassName={BOARD_SELECT_CLASS}
                    contentClassName="rounded-[6px] border-border shadow-lg"
                    hideSearch
                  />
                </div>

                <div>
                  <Combobox
                    value={filters.vencimiento ?? ""}
                    onChange={(value) =>
                      setFilters((current) => ({
                        ...current,
                        vencimiento: (value || undefined) as
                          | TeamTaskDueFilter
                          | undefined,
                      }))
                    }
                    options={DUE_FILTER_OPTIONS}
                    placeholder="Filtrar vencimiento"
                    triggerClassName={BOARD_SELECT_CLASS}
                    contentClassName="rounded-[6px] border-border shadow-lg"
                    hideSearch
                  />
                </div>

                <div>
                  <Combobox
                    value={filters.responsableMembershipId ?? ""}
                    onChange={(value) =>
                      setFilters((current) => ({
                        ...current,
                        responsableMembershipId: value || undefined,
                      }))
                    }
                    options={[
                      {
                        value: "",
                        label: "Todos los responsables",
                        searchText: "todos",
                      },
                      ...assigneeOptions,
                    ]}
                    placeholder="Filtrar responsable"
                    emptyMessage="No hay responsables para esta empresa."
                    triggerClassName={BOARD_SELECT_CLASS}
                    contentClassName="rounded-[6px] border-border shadow-lg"
                  />
                </div>
              </div>
            </div>

            {error ? (
              <div className="mt-3 rounded-[5px] border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
                {error}
              </div>
            ) : null}
          </div>

          <div>
            <section
              className={cn(
                "grid divide-x divide-border",
                visibleStatuses.length === 1 ? "grid-cols-1" : "grid-cols-5",
              )}
            >
              {visibleStatuses.map((status) => {
                const meta = STATUS_META[status];
                const columnTasks = tasks.filter((task) => task.estado === status);
                const pagination = columnPagination[status];

                return (
                  <div key={status} className={cn("min-h-[360px]", meta.columnClass)}>
                    <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/50 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-1.5 w-1.5 rounded-full", meta.dotClass)} />
                        <h2 className="text-xs font-medium text-foreground">
                          {meta.label}
                        </h2>
                      </div>
                      <span className={cn("flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-border px-1.5 text-[10px] font-medium", meta.countClass)}>
                        {summary.byStatus[status] ?? columnTasks.length}
                      </span>
                    </div>
                    <p className="border-b border-border px-3 py-2 text-[11px] text-muted-foreground">
                      {meta.description}
                    </p>

                    <div className="flex flex-col gap-2 p-2">
                      {columnTasks.length ? (
                        columnTasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            canManage={canManage}
                            canDelete={canDelete}
                            onEdit={openEditDialog}
                            onDelete={handleDelete}
                            onStatusChange={handleStatusChange}
                          />
                        ))
                      ) : (
                        <div className="rounded-[5px] px-3 py-5 text-center text-[11px] text-muted-foreground">
                          Sin tareas en este estado.
                        </div>
                      )}
                    </div>

                    {pagination?.hasNextPage ? (
                      <div className="border-t border-border p-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={loadingMoreStatus === status}
                          onClick={() => handleLoadMore(status)}
                          className="h-8 w-full rounded-[5px] border-border bg-background px-3 text-xs font-medium text-muted-foreground shadow-none hover:bg-muted hover:text-foreground"
                        >
                          {loadingMoreStatus === status ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          Ver más tareas
                        </Button>
                        <p className="mt-1 text-center text-[10px] text-muted-foreground">
                          {columnTasks.length} de {pagination.total}
                        </p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </section>
          </div>
        </section>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden rounded-[6px] border border-border bg-card p-0 shadow-xl">
          <DialogHeader className="border-b border-border bg-muted/50 px-5 py-4">
            <DialogTitle className="text-base font-medium tracking-[-0.01em] text-foreground">
              {editingTask ? "Editar tarea" : "Nueva tarea"}
            </DialogTitle>
            <DialogDescription className="max-w-xl text-xs leading-5 text-muted-foreground">
              Definí el responsable, la fecha límite y las observaciones
              operativas.
            </DialogDescription>
          </DialogHeader>

          <form
            className="max-h-[calc(90vh-132px)] space-y-4 overflow-y-auto p-5"
            onSubmit={handleSubmit}
          >
            <div className="space-y-2">
              <Label htmlFor="titulo" className={LABEL_CLASS}>
                Título
              </Label>
              <Input
                id="titulo"
                value={form.titulo}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    titulo: event.target.value,
                  }))
                }
                placeholder="Ej. Confirmar documentación del operador"
                className={CONTROL_CLASS}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className={LABEL_CLASS}>Responsable</Label>
                <Combobox
                  value={form.responsableMembershipId}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      responsableMembershipId: value,
                    }))
                  }
                  options={assigneeOptions}
                  placeholder="No establecido"
                  emptyMessage="No hay responsables para esta empresa."
                  triggerClassName={CONTROL_CLASS}
                  contentClassName="rounded-[6px] border-border shadow-lg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fechaLimite" className={LABEL_CLASS}>
                  Fecha límite
                </Label>
                <Input
                  id="fechaLimite"
                  type="date"
                  value={form.fechaLimite}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      fechaLimite: event.target.value,
                    }))
                  }
                  className={CONTROL_CLASS}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion" className={LABEL_CLASS}>
                Descripción
              </Label>
              <Textarea
                id="descripcion"
                value={form.descripcion}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    descripcion: event.target.value,
                  }))
                }
                placeholder="Qué se necesita hacer y con qué criterio se considera listo."
                className={cn(TEXTAREA_CLASS, "min-h-28")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observaciones" className={LABEL_CLASS}>
                Observaciones
              </Label>
              <Textarea
                id="observaciones"
                value={form.observaciones}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    observaciones: event.target.value,
                  }))
                }
                placeholder="Notas de seguimiento, bloqueos, acuerdos o contexto operativo."
                className={cn(TEXTAREA_CLASS, "min-h-24")}
              />
            </div>

            <DialogFooter className="border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isSaving}
                className="h-8 rounded-[5px] border-border bg-background px-3 text-xs font-medium text-muted-foreground shadow-none hover:bg-muted hover:text-foreground"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="h-8 rounded-[5px] bg-[#01ADFB] px-3 text-xs font-medium text-white shadow-none hover:bg-[#0198dc]"
              >
                {isSaving ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                {editingTask ? "Guardar cambios" : "Crear tarea"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "sky" | "amber" | "rose";
}) {
  const toneClass = {
    slate: "bg-slate-400",
    sky: "bg-[#01ADFB]",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
  }[tone];
  const valueClass = tone === "rose" ? "text-rose-600" : "text-foreground";

  return (
    <div className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-b-0 md:odd:border-r xl:border-b-0 xl:border-r xl:last:border-r-0">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", toneClass)} />
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        <p className={cn("mt-1 text-xl font-medium leading-none", valueClass)}>
          {value}
        </p>
      </div>
    </div>
  );
}

function TaskCard({
  task,
  canManage,
  canDelete,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  task: TeamTask;
  canManage: boolean;
  canDelete: boolean;
  onEdit: (task: TeamTask) => void;
  onDelete: (task: TeamTask) => void;
  onStatusChange: (task: TeamTask, estado: TeamTaskStatus) => void;
}) {
  const overdue = isTaskOverdue(task);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group w-full rounded-[5px] border border-border bg-background p-2.5 text-left shadow-none transition hover:border-muted-foreground/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#01ADFB]/20"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center gap-1.5">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    overdue ? "bg-rose-500" : STATUS_META[task.estado].dotClass,
                  )}
                />
                <span className="truncate text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  {STATUS_META[task.estado].label}
                </span>
              </div>
              <h3 className="line-clamp-2 text-xs font-medium leading-snug text-foreground">
                {task.titulo}
              </h3>
            </div>
            <MoreHorizontal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-hover:text-foreground" />
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
            <span className="truncate font-medium">
              {task.responsable?.name ?? "No establecido"}
            </span>
            <span
              className={cn(
                "shrink-0 rounded-[4px] border px-1.5 py-0.5 text-[9px] font-medium",
                overdue
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-border bg-muted text-muted-foreground",
              )}
            >
              {formatDate(task.fechaLimite)}
            </span>
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={10}
        className="w-[min(92vw,380px)] overflow-visible rounded-[6px] border-border bg-card p-0 shadow-xl"
      >
        <div className="border-b border-border bg-muted/50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Badge className={cn("rounded-[4px] px-1.5 py-0.5 text-[9px] font-medium", STATUS_META[task.estado].badgeClass)}>
                {STATUS_META[task.estado].label}
              </Badge>
              <h3 className="mt-2 text-sm font-medium leading-snug text-foreground">
                {task.titulo}
              </h3>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Creada {formatDate(task.createdAt)} por {task.asignadaPor.name}
              </p>
            </div>
            {overdue ? (
              <Badge className="shrink-0 rounded-[4px] border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[9px] font-medium text-rose-700">
                Vencida
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[5px] border border-border bg-background p-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Responsable
              </p>
              <p className="mt-1 truncate text-xs font-medium text-foreground">
                {task.responsable?.name ?? "No establecido"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {task.responsable?.role ?? "Disponible para el equipo"}
              </p>
            </div>
            <div className="rounded-[5px] border border-border bg-background p-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Límite
              </p>
              <p
                className={cn(
                  "mt-1 text-xs font-medium",
                  overdue ? "text-rose-700" : "text-foreground",
                )}
              >
                {formatDate(task.fechaLimite)}
              </p>
            </div>
          </div>

          {task.descripcion ? (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Descripción
              </p>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                {task.descripcion}
              </p>
            </div>
          ) : null}

          {task.observaciones ? (
            <div className="rounded-[5px] border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              <span className="font-medium">Obs. </span>
              {task.observaciones}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label className={LABEL_CLASS}>Cambiar estado</Label>
            <Combobox
              value={task.estado}
              onChange={(value) =>
                onStatusChange(task, value as TeamTaskStatus)
              }
              options={STATUS_OPTIONS.map((option) => ({
                ...option,
                label: `Mover a ${option.label.toLowerCase()}`,
              }))}
              placeholder="Cambiar estado"
              triggerClassName={SELECT_CLASS}
              contentClassName="z-[70] rounded-[6px] border-border shadow-lg"
              hideSearch
            />
          </div>

          {canManage || canDelete ? (
            <div className="flex gap-2 border-t border-border pt-3">
              {canManage ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 flex-1 rounded-[5px] border-border bg-background px-3 text-xs font-medium text-muted-foreground shadow-none hover:bg-muted hover:text-foreground"
                  onClick={() => onEdit(task)}
                >
                  Editar
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 rounded-[5px] border-rose-200 bg-rose-50 px-2 text-rose-700 shadow-none hover:bg-rose-100 hover:text-rose-800"
                  onClick={() => onDelete(task)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

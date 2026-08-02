import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { Attachment, Board, Comment, Task, User } from "./types";

export const boardKeys = {
  all: ["boards"] as const,
  detail: (id: string) => ["boards", id] as const,
};

export const userKeys = {
  all: ["users"] as const,
  byBoard: (boardId: string) => ["users", { boardId }] as const,
};

export function useBoards() {
  return useQuery({
    queryKey: boardKeys.all,
    queryFn: async () => {
      const res = await api.get<{ boards: Board[] }>("/api/boards");
      return res.data.boards;
    },
  });
}

export function useBoard(id: string | undefined) {
  return useQuery({
    queryKey: id ? boardKeys.detail(id) : ["boards", "none"],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await api.get<{ board: Board }>(`/api/boards/${id}`);
      return res.data.board;
    },
  });
}

export function useBoardMembers(boardId: string | undefined) {
  return useQuery({
    queryKey: boardId ? userKeys.byBoard(boardId) : ["users", "none"],
    enabled: Boolean(boardId),
    queryFn: async () => {
      const res = await api.get<{ users: User[] }>(
        `/api/users?boardId=${boardId}`,
      );
      return res.data.users;
    },
  });
}

interface CreateBoardInput {
  name: string;
  description?: string;
  columns?: string[];
}

export function useCreateBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBoardInput) => {
      const res = await api.post<{ board: Board }>("/api/boards", input);
      return res.data.board;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: boardKeys.all });
    },
  });
}

interface UpdateBoardInput {
  id: string;
  name?: string;
  description?: string | null;
  columns?: string[];
}

export function useUpdateBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateBoardInput) => {
      const res = await api.put<{ board: Board }>(`/api/boards/${id}`, body);
      return res.data.board;
    },
    onSuccess: (board) => {
      qc.invalidateQueries({ queryKey: boardKeys.all });
      qc.invalidateQueries({ queryKey: boardKeys.detail(board.id) });
    },
  });
}

export function useAddBoardMember(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      username?: string;
      email?: string;
      userId?: string;
    }) => {
      const res = await api.post<{ user: User }>(
        `/api/boards/${boardId}/members`,
        input,
      );
      return res.data.user;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
      qc.invalidateQueries({ queryKey: userKeys.byBoard(boardId) });
    },
  });
}

export function useRemoveBoardMember(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/api/boards/${boardId}/members/${userId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
      qc.invalidateQueries({ queryKey: userKeys.byBoard(boardId) });
    },
  });
}

export function useUserSearch(search: string, enabled = true) {
  const trimmed = search.trim();
  return useQuery({
    queryKey: [...userKeys.all, "search", trimmed] as const,
    enabled,
    queryFn: async () => {
      const res = await api.get<{ users: User[] }>("/api/users", {
        params: { search: trimmed || undefined, limit: 10 },
      });
      return res.data.users;
    },
  });
}

export function useDeleteBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/boards/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: boardKeys.all });
    },
  });
}

interface CreateTaskInput {
  boardId: string;
  title: string;
  description?: string;
  status?: string;
  assignedToId?: string | null;
  dueDate?: string | null;
  priority?: number | null;
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const res = await api.post<{ task: Task }>("/api/tasks", input);
      return res.data.task;
    },
    onSuccess: (task) => {
      qc.invalidateQueries({ queryKey: boardKeys.detail(task.boardId) });
    },
  });
}

interface UpdateTaskInput {
  id: string;
  boardId: string;
  title?: string;
  description?: string | null;
  status?: string;
  assignedToId?: string | null;
  dueDate?: string | null;
  priority?: number | null;
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, boardId, ...body }: UpdateTaskInput) => {
      void boardId;
      const res = await api.put<{ task: Task }>(`/api/tasks/${id}`, body);
      return res.data.task;
    },
    onMutate: async (input) => {
      const previous = qc.getQueryData<Board>(boardKeys.detail(input.boardId));
      if (previous?.tasks) {
        qc.setQueryData<Board>(boardKeys.detail(input.boardId), {
          ...previous,
          tasks: previous.tasks.map((t) =>
            t.id === input.id ? { ...t, ...input } : t,
          ),
        });
      }
      await qc.cancelQueries({ queryKey: boardKeys.detail(input.boardId) });
      return { previous };
    },
    onError: (_err, input, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(boardKeys.detail(input.boardId), ctx.previous);
      }
    },
    onSettled: (_data, _err, input) => {
      qc.invalidateQueries({ queryKey: boardKeys.detail(input.boardId) });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; boardId: string }) => {
      await api.delete(`/api/tasks/${id}`);
    },
    onSuccess: (_data, { boardId }) => {
      qc.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
    },
  });
}

export const commentKeys = {
  byTask: (taskId: string) => ["comments", { taskId }] as const,
};

export function useComments(taskId: string | undefined) {
  return useQuery({
    queryKey: taskId ? commentKeys.byTask(taskId) : ["comments", "none"],
    enabled: Boolean(taskId),
    queryFn: async () => {
      const res = await api.get<{ comments: Comment[] }>(
        `/api/comments?taskId=${taskId}`,
      );
      return res.data.comments;
    },
  });
}

export function useCreateComment(boardId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      content,
    }: {
      taskId: string;
      content: string;
    }) => {
      const res = await api.post<{ comment: Comment }>("/api/comments", {
        taskId,
        content,
      });
      return res.data.comment;
    },
    onSuccess: (comment) => {
      qc.invalidateQueries({ queryKey: commentKeys.byTask(comment.taskId) });
      if (boardId)
        qc.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
    },
  });
}

export function useUpdateComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const res = await api.put<{ comment: Comment }>(`/api/comments/${id}`, {
        content,
      });
      return res.data.comment;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commentKeys.byTask(taskId) });
    },
  });
}

export function useDeleteComment(taskId: string, boardId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/comments/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commentKeys.byTask(taskId) });
      if (boardId)
        qc.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
    },
  });
}

export const attachmentKeys = {
  byTask: (taskId: string) => ["attachments", { taskId }] as const,
};

export function useAttachments(taskId: string | undefined) {
  return useQuery({
    queryKey: taskId ? attachmentKeys.byTask(taskId) : ["attachments", "none"],
    enabled: Boolean(taskId),
    queryFn: async () => {
      const res = await api.get<{ attachments: Attachment[] }>(
        `/api/attachments?taskId=${taskId}`,
      );
      return res.data.attachments;
    },
  });
}

export function useUploadAttachment(boardId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, file }: { taskId: string; file: File }) => {
      const formData = new FormData();
      formData.append("taskId", taskId);
      formData.append("file", file);
      const res = await api.post<{ attachment: Attachment }>(
        "/api/attachments",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return res.data.attachment;
    },
    onSuccess: (attachment) => {
      qc.invalidateQueries({
        queryKey: attachmentKeys.byTask(attachment.taskId),
      });
      if (boardId)
        qc.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
    },
  });
}

export function useDeleteAttachment(
  taskId: string,
  boardId: string | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/attachments/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: attachmentKeys.byTask(taskId) });
      if (boardId)
        qc.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
    },
  });
}

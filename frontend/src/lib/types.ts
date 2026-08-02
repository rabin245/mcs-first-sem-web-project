export interface User {
  id: string;
  username: string;
  email: string;
}

export interface Task {
  id: string;
  boardId: string;
  title: string;
  description: string | null;
  status: string;
  assignee: User | null;
  dueDate: string | null;
  priority: number | null;
  _count?: { comments: number; attachments: number };
}

export interface Board {
  id: string;
  name: string;
  description: string | null;
  columns: string[];
  creator: User;
  members: { user: User }[];
  tasks?: Task[];
  _count?: { tasks: number };
}

export interface Comment {
  id: string;
  taskId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: User;
}

export interface Attachment {
  id: string;
  taskId: string;
  fileName: string;
  filePath: string;
  createdAt: string;
  uploader: User;
}

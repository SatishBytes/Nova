const { z } = require('zod');

const identifier = z.string().trim().min(1).max(200);
const emptyBody = z.object({}).strict();
const pagination = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
}).passthrough();
const projectIdParams = z.object({ id: identifier }).passthrough();
const taskIdParams = z.object({ id: identifier }).passthrough();
const projectParam = z.object({ projectId: identifier }).passthrough();
const optionalTaskFields = {
  title: z.string().trim().min(1).max(100),
  description: z.string().max(500).nullable(),
  status: z.enum(['todo', 'in_progress', 'done']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  due_date: z.string().date().nullable(),
  labels: z.array(z.string().trim().min(1).max(20)).max(10),
  progress: z.number().finite().min(0).max(100),
  position: z.number().finite(),
  assignee_id: identifier.nullable(),
};

const schemas = {
  projectCreate: { body: z.object({ name: z.string().trim().min(1).max(100), description: z.string().max(500).optional() }).strict() },
  projectUpdate: { params: projectIdParams, body: z.object({ name: optionalTaskFields.title, description: z.string().max(500) }).strict().refine((value) => Object.keys(value).length > 0) },
  projectId: { params: projectIdParams },
  taskId: { params: taskIdParams },
  projectList: {
    query: pagination.extend({ search: z.string().trim().max(100).optional() }),
  },
  archivedProjectList: { query: pagination },
  archivedProjectId: { params: projectIdParams },
  taskCreate: {
    body: z.object({
      project_id: identifier,
      title: optionalTaskFields.title,
      description: optionalTaskFields.description.optional(),
      status: optionalTaskFields.status.optional(),
      priority: optionalTaskFields.priority.optional(),
      due_date: optionalTaskFields.due_date.optional(),
      labels: optionalTaskFields.labels.optional(),
      progress: optionalTaskFields.progress.optional(),
      position: optionalTaskFields.position.optional(),
      assignee_id: optionalTaskFields.assignee_id.optional(),
    }).strict(),
  },
  taskProject: { params: projectParam, query: pagination },
  taskUpdate: { params: taskIdParams, body: z.object(optionalTaskFields).partial().strict().refine((value) => Object.keys(value).length > 0) },
  taskReorder: {
    body: z.object({
      project_id: identifier,
      moves: z.array(z.object({
        id: identifier,
        status: optionalTaskFields.status,
        position: optionalTaskFields.position,
      }).strict()).max(100),
    }).strict(),
  },
  subtaskCreate: { params: taskIdParams, body: z.object({ title: optionalTaskFields.title }).strict() },
  subtaskUpdate: {
    params: taskIdParams,
    body: z.object({
      title: optionalTaskFields.title.optional(),
      done: z.boolean().optional(),
      position: optionalTaskFields.position.optional(),
    }).strict().refine((value) => Object.keys(value).length > 0),
  },
  commentRead: { params: taskIdParams, query: pagination },
  commentCreate: { params: taskIdParams, body: z.object({ body: z.string().trim().min(1).max(2000) }).strict() },
  teamCreate: { body: z.object({ project_id: identifier, email: z.string().email().max(254), role: z.enum(['member', 'viewer']).optional() }).strict() },
  teamProject: { params: projectParam, query: pagination },
  projectActivity: { params: projectParam, query: pagination },
  teamUpdate: { params: taskIdParams, body: z.object({ role: z.enum(['member', 'viewer']) }).strict() },
  notificationId: { params: taskIdParams },
  notificationRead: { query: pagination },
  aiGenerate: { body: z.object({ project_id: identifier, description: z.string().trim().min(1).max(2000) }).strict() },
  accountDelete: { body: z.object({ email: z.string().email().max(254) }).strict() },
};

module.exports = { schemas, pagination, emptyBody };

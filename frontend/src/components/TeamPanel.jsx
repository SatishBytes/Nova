import { useCallback, useEffect, useState } from 'react';
import { MailPlus, UserMinus, Users } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/axiosInstance';
import Avatar from './ui/Avatar';
import Badge from './ui/Badge';
import Button from './ui/Button';
import Input from './ui/Input';
import Modal from './ui/Modal';

const TeamPanel = ({ projectId, open, onClose, role, userId }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [inviting, setInviting] = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, headers } = await api.get(`/team/project/${projectId}`, { params: { limit: 50, offset: 0 } });
      setMembers(data);
      setHasMore(Number(headers?.['x-total-count'] || Math.max(0, data.length - 1)) > Math.max(0, data.length - 1));
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to load project members.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const offset = Math.max(0, members.length - 1);
      const { data, headers } = await api.get(`/team/project/${projectId}`, { params: { limit: 50, offset } });
      setMembers((current) => [...current, ...data.slice(1)]);
      setHasMore(Number(headers?.['x-total-count'] || offset + data.length - 1) > offset + data.length - 1);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to load more members.');
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (open) void Promise.resolve().then(fetchMembers);
  }, [fetchMembers, open]);

  const invite = async (event) => {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail) return;
    if (inviting) return;
    setInviting(true);
    try {
      const { data } = await api.post('/team', {
        project_id: projectId,
        email: normalizedEmail,
        role: inviteRole,
      });
      setEmail('');
      await fetchMembers();
      toast.success(data.status === 'pending' ? 'Invite saved. It will activate after signup.' : 'Member invited');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to invite this member.');
    } finally {
      setInviting(false);
    }
  };

  const changeRole = async (memberId, nextRole) => {
    try {
      await api.patch(`/team/${memberId}`, { role: nextRole });
      setMembers((current) => current.map((member) => (
        member.id === memberId ? { ...member, role: nextRole } : member
      )));
      toast.success('Member role updated');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to update member role.');
    }
  };

  const remove = async (member) => {
    const leaving = member.user_id === userId && role !== 'owner';
    const confirmed = window.confirm(leaving ? 'Leave this project?' : `Remove ${member.email} from the project?`);
    if (!confirmed) return;
    try {
      await api.delete(`/team/${member.id}`);
      setMembers((current) => current.filter((entry) => entry.id !== member.id));
      toast.success(leaving ? 'You left the project' : 'Member removed');
      if (leaving) onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to remove this member.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Project team"
      description="Collaborate with teammates using role-based access."
      className="team-panel-dialog"
    >
      <div className="space-y-5">
        {role === 'owner' && (
          <form onSubmit={invite} className="rounded-xl border border-border bg-background p-3">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <MailPlus size={16} aria-hidden="true" />
              Invite by email
            </h3>
            <label className="sr-only" htmlFor="team-invite-email">Email address</label>
            <Input
              id="team-invite-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teammate@example.com"
              autoComplete="email"
            />
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <label className="sr-only" htmlFor="team-invite-role">Member role</label>
              <select
                id="team-invite-role"
                className="ui-input !min-h-10"
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value)}
              >
                <option value="member">Member — can edit tasks</option>
                <option value="viewer">Viewer — read only</option>
              </select>
              <Button type="submit" className="shrink-0" disabled={!email.trim() || inviting}>
                <MailPlus size={15} aria-hidden="true" />
                {inviting ? 'Inviting…' : 'Invite'}
              </Button>
            </div>
          </form>
        )}

        <section aria-labelledby="team-members-heading">
          <h3 id="team-members-heading" className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Users size={16} aria-hidden="true" />
            Members
            <Badge tone="neutral">{members.length}</Badge>
          </h3>
          {loading ? (
            <p className="py-4 text-sm text-muted" role="status">Loading team...</p>
          ) : members.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">
              No project members yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {members.map((member) => (
                <li key={member.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-2.5">
                  <Avatar
                    name={member.profile?.display_name || member.email}
                    email={member.email}
                    color={member.profile?.avatar_color}
                    className="!h-9 !w-9"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {member.profile?.display_name || member.email || 'Pending invite'}
                      {member.is_owner && <span className="ml-1 text-xs text-muted">(project owner)</span>}
                    </p>
                    <p className="truncate text-xs text-muted">{member.email || 'Project owner'}</p>
                  </div>
                  {member.is_owner ? (
                    <Badge tone="primary">Owner</Badge>
                  ) : member.status === 'pending' ? (
                    <Badge tone="warning">Invite pending</Badge>
                  ) : role === 'owner' ? (
                    <label>
                      <span className="sr-only">Role for {member.email}</span>
                      <select
                        className="ui-input !min-h-8 w-auto py-1 text-xs"
                        value={member.role}
                        onChange={(event) => changeRole(member.id, event.target.value)}
                        aria-label={`Role for ${member.email}`}
                      >
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </label>
                  ) : <Badge tone={member.role === 'viewer' ? 'neutral' : 'success'}>{member.role}</Badge>}
                  {!member.is_owner && (role === 'owner' || member.user_id === userId) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={member.user_id === userId && role !== 'owner' ? 'Leave project' : `Remove ${member.email}`}
                      onClick={() => remove(member)}
                    >
                      <UserMinus size={16} aria-hidden="true" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {hasMore && <Button variant="ghost" size="sm" className="mt-2" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more members'}</Button>}
        </section>
      </div>
    </Modal>
  );
};

export default TeamPanel;

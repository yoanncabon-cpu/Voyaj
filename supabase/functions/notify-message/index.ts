// notify-message — Push au destinataire d'un nouveau message.
// Appelée par le déclencheur SQL notify_on_new_message (secret partagé).
// Déployée avec --no-verify-jwt.
import { adminClient, requireWebhookSecret, serve } from '../_shared/http.ts';
import { pushToUsers } from '../_shared/push.ts';

serve(async (req, body) => {
  requireWebhookSecret(req);
  const msg = body?.record;
  if (!msg?.conversation_id || !msg?.sender_id) return { skipped: true };

  const db = adminClient();
  const [{ data: conv }, { data: sender }] = await Promise.all([
    db.from('conversations').select('user_a, user_b').eq('id', msg.conversation_id).single(),
    db.from('profiles').select('name').eq('id', msg.sender_id).single(),
  ]);
  if (!conv) return { skipped: true };
  const recipient = conv.user_a === msg.sender_id ? conv.user_b : conv.user_a;

  const { data: blocked } = await db.from('user_blocks').select('blocker_id')
    .eq('blocker_id', recipient).eq('blocked_id', msg.sender_id).maybeSingle();
  if (blocked) return { skipped: true };

  const text = String(msg.content ?? '');
  await pushToUsers(db, [recipient], {
    title: sender?.name ?? 'Nouveau message',
    body: text.length > 120 ? text.slice(0, 117) + '…' : text,
    route: `/messages/${msg.conversation_id}`,
    data: { type: 'message', conversationId: msg.conversation_id },
  });
  return { sent: true };
});

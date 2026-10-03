// LLM gate for confessions. Every submission is classified before it is stored:
//   allow  -> approved immediately, flies onto the wall
//   review -> stored as pending, host decides on /admin
//   block  -> rejected at submit time, never stored
// Any failure (no key, timeout, API error, model refusal, unparseable output) falls back
// to "review" so nothing ever reaches the wall unchecked.
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

const Verdict = z.object({
  verdict: z.enum(['allow', 'review', 'block']),
  reason: z.string(),
});

const SYSTEM = `You are the content gate for a private party's "most evil thing you did this year" confession wall. Guests type a name and a confession on their phone; approved confessions float on big projector screens for a room of adults.

The wall is SUPPOSED to be edgy. Crude language, sex, drugs, pettiness, lying, cheating, theft, gross-out humor, dark jokes, self-deprecation, swearing, roasting friends, and absurd claims are all ALLOWED. Do not block something merely because it is offensive, vulgar, immoral, or in bad taste.

BLOCK (hateful or dangerous, never shown):
- Slurs or demeaning language aimed at a protected group: race, ethnicity, nationality, religion, gender, sexual orientation, gender identity, disability. Includes misspelled, spaced, or leetspeak slurs.
- Coded hate / dog whistles: 1488, 88, 14 words, (((echoes))), 13/50 or 13/52, "jogger", "noticing", "every single time", "great replacement", "globalists" used as a slur, Nazi or KKK references, praising genocide or ethnic cleansing.
- Mocking a group's religion, ethnicity or nationality as "terrorists", "criminals", etc.
- Sexual content involving minors in any form (including "loli", "shota", or age hints).
- Threats or glorification of violence, terrorism, mass shootings, or political assassination (including conspiracy jokes that blame a real person or group for an assassination).
- Doxxing: phone numbers, addresses, or other private details of a real person.

REVIEW (let the host decide) when it is genuinely ambiguous: possible dog whistle you are not sure about, a named real private person being accused of something serious, incest/bestiality/non-consent references that may be a joke, or anything you cannot confidently place in allow or block.

Otherwise ALLOW. Be decisive: most confessions should be "allow". Respond with the verdict and a reason of at most 12 words.`;

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ timeout: 15000, maxRetries: 1 });
  return client;
}

export async function moderate({ name, text }) {
  const c = getClient();
  if (!c) return { verdict: 'review', reason: 'no moderation key configured', model: null };
  const started = Date.now();
  try {
    const response = await c.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 300,
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      output_config: { effort: 'low', format: zodOutputFormat(Verdict) },
      messages: [{ role: 'user', content: `Classify this confession.\nName: ${JSON.stringify(name)}\nConfession: ${JSON.stringify(text)}` }],
    });
    const ms = Date.now() - started;
    if (response.stop_reason === 'refusal') return { verdict: 'review', reason: 'model declined to classify', model: response.model, ms };
    const v = response.parsed_output;
    if (!v) return { verdict: 'review', reason: 'unparseable verdict', model: response.model, ms };
    return { verdict: v.verdict, reason: v.reason.slice(0, 120), model: response.model, ms };
  } catch (e) {
    console.error('moderation error', e?.status, e?.message);
    return { verdict: 'review', reason: 'moderation unavailable: ' + String(e?.message || e).slice(0, 60), model: null, ms: Date.now() - started };
  }
}

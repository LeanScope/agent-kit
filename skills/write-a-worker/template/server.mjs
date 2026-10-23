// A LeanScope worker. The hosted agent server POSTs here every time the step (or need) your worker
// is attached to fires it. Answer when the work is DONE: by default the session waits for this
// response (set `waitForCompletion` to "false" on the worker to answer at once and report the end
// through the activity instead).
import express from 'express';
import { readArguments, reportActivity, insertStep } from './leanscope.mjs';

const app = express();
app.use(express.json({ limit: '5mb' }));

// Keep the path hard to guess: anyone who knows the URL can call it.
const PATH = process.env.WORKER_PATH ?? '/leanscope/worker';

app.post(PATH, async (req, res) => {
  const bearer = (req.headers.authorization ?? '').replace(/^Bearer /, '');
  const body = req.body;
  try {
    const args = await readArguments(body, bearer);
    const input = body.config.context.input; // the answer that fired a need, if any

    await reportActivity(body, { summary: 'Working on it', phase: 'working' });

    // ---- your work goes here ------------------------------------------------------------------
    const result = `Received ${JSON.stringify(input ?? {})} with arguments ${JSON.stringify(args)}`;
    // Optionally extend the running choreo (needs requiresChoreoCopy on the worker):
    // await insertStep(body, 'Thank the person and summarise what you found.');
    // --------------------------------------------------------------------------------------------

    await reportActivity(body, { phase: 'succeeded', summary: result, progress: 1 });
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[worker] failed:', error);
    // A non-2xx answer shows on the session step as "<worker> failed: <reason>".
    res.status(500).send(String(error.message ?? error));
  }
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`LeanScope worker listening on :${port}${PATH}`));

// Keep imports used even while the example code above is commented out.
void insertStep;

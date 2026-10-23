# Example — an interview from a guide, over a live voice call

An AI persona interviews one real person by voice. The questions come from an interview guide the
person (or you) uploads; every answer lands in the choreo's 🍱 Inventory as one filled slot per
question — whatever order the conversation took.

## The choreo, step by step

1. **Upload the guide** — a step with an upload question (a facet with `format: data-url`,
   `contentMediaType: text/markdown` or a Word document).
2. **Turn the guide into questions** — a worker attached to the upload's need reads the document and
   declares one Inventory slot per question in the guide (LeanScope hosts a worker for this; ask for
   it to be attached).
3. **The interview** — a step with a 🎙 Realtime Model attached becomes a live call led by the lead
   persona. It asks the open slots, follows the person when they jump ahead, and ends itself when every
   slot is answered.
4. **Wrap up** — a closing step thanks the person; the answers are in the Inventory.

## Try it

You need a choreo of this shape in your repository and your OpenAI key (the call uses it).

```bash
export LEANSCOPE_CHOREO_SCENARIO_GUID=<the interview choreo's _guid>
```

Then ask your agent: *"Run the interview choreo — I'll answer as the interviewee."* The agent starts the
session (`run-a-choreo`) and gives you the browser link: the live call happens there, with your
microphone.

To build your own: *"Model a choreo like examples/interview-from-guide for a customer-feedback
interview."* (`model-a-choreo`).

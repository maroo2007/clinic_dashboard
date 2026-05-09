# DentaFlow — n8n Workflow Exports

## Available Workflows

### `clinic-follow-up-bot.json`
**Clinic Follow-Up Bot — AI Reply Handler** (23 nodes)

The core AI workflow that handles all inbound WhatsApp messages.

**Import instructions:**
1. Open your n8n instance
2. Click **Workflows** → **Import from File**
3. Select `clinic-follow-up-bot.json`
4. After import, update these placeholder values:
   - `${GROQ_API_KEY}` → Your Groq API key (in **Groq AI** node)
   - `${EVOLUTION_API_KEY}` → Your Evolution API key (in **Send Patient Reply**, **Notify Manager**, **Send Review Link** nodes)
   - `${EVOLUTION_API_BASE_URL}` → Your Evolution API URL (in all Evolution nodes)
   - `${BACKEND_PUBLIC_URL}` → Your backend's public URL (in **Save Inbound to Backend**, **Save AI Reply to Backend**, **Create Appointment** nodes)
   - `${N8N_INTERNAL_SECRET}` → Your N8N_INTERNAL_SECRET value (in all backend bridge nodes)
5. Add a **Clinic PostgreSQL** credential pointing to your `dental_saas` database
6. Activate the workflow

**Webhook URL** (configure in Evolution API):
```
https://your-n8n-instance/webhook/clinic-whatsapp
```

## Exporting Updated Workflows

After making changes in n8n, export updated workflows with:

```bash
# Via n8n UI: Workflows → ⋮ → Download
# Save to this directory as: workflows/workflow-name.json

# Or via n8n API:
curl -s "https://your-n8n/api/v1/workflows/XiK4DRb5OuxZV0sX" \
  -H "X-N8N-API-KEY: your-api-key" | python3 -m json.tool > workflows/clinic-follow-up-bot.json
```

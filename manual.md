ara ver logs del worker en tiempo real si quieres confirmar que procesa jobs:
gcloud run jobs executions list --job=devcast-worker \
  --region=us-central1 --project=lilicurl --limit=5

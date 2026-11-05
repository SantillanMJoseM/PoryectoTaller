import sys, json, os
sys.path.insert(0, '/home/developer/AI-Project-Factory')
from pathlib import Path
import orchestration.runtime.runtime as rt
from orchestration.runtime.opencode_adapter import OpenCodeAdapter

DB='/home/developer/projects/sistema-taller/.factory/runtime.db'
ROOT='/home/developer/projects/sistema-taller'
FACTORY='/home/developer/AI-Project-Factory'
conn=rt.get_conn(DB)
project=rt.get_project(conn,'PROJECT-001')

# task index arg
idx=int(sys.argv[1]) if len(sys.argv)>1 else 0
task_map=json.loads(Path(f'{ROOT}/.factory/task_map.json').read_text())
tid=task_map[str(idx)]
task=rt.get_task(conn,tid)

MODEL=os.environ.get('APF_MODEL','opencode-go/qwen3.8-flash')
adapter=OpenCodeAdapter(use_sandbox=False, timeout=600)

# dependency context: read previous outputs if any
previous_outputs={}
for t in rt.list_tasks(conn,'PROJECT-001'):
    if t['task_id']==tid: continue
    # load saved output file if exists
    outpath=Path(f'{ROOT}/.factory/outputs/{t["task_id"]}.txt')
    if outpath.exists():
        previous_outputs[t['task_id']]=outpath.read_text()[:3000]

deps=json.loads(task['dependencies'] or '[]')
dep_context=''
if deps:
    dep_context='\n\nInputs from completed dependency tasks (summaries):\n'
    for dep_id in deps:
        if dep_id in previous_outputs:
            dep_context+=f'\n--- {dep_id} ---\n{previous_outputs[dep_id][:1500]}\n'

stack_note = """
Stack (mandatory): React + TypeScript + Tailwind CSS + shadcn/ui + Supabase.
Project root: /home/developer/projects/sistema-taller
Do not modify AI-Project-Factory or other projects.
Produce files inside project root only.
Use Spanish for UI text.

SOURCE OF TRUTH: docs/requirements/SOURCE_PROMPT.md (copied from /home/developer/prompts/PROMPT_SISTEMA_TALLER.md).
You MUST conserve ALL modules and business rules from that document. Do NOT invent new modules or change module names.
Required modules: Autenticacion admin, Panel principal, Clientes, Productos, Servicios, Ordenes de trabajo, Ventas, Garantias, Financiero, Archivos/Documentos, Usuarios, Permisos, Informes/Reportes, Auditoria, Cola de emails, Portal del cliente, Configuracion de empresa.
Required entities/tables as in source prompt (nombres en espanol).
"""


prompt = f"""You are {task['agent_id']} working on Sistema Taller.

Project: {project['name']}
Repository: {project['repo_path']}
Task: {task['title']} ({tid})
Objective: {task['objective']}

{stack_note}
Deliverables expected: {task['outputs']}

Instructions:
- Work only in the current directory: {project['repo_path']}
- Do not read or write files outside this directory (except reading factory agent defs is okay).
- Create all deliverables as files.
- You MUST use the write/edit tools to actually create or modify files. Do not only describe them.
- For analysis/design tasks, write markdown under docs/.
- For code tasks, write runnable code.
- Run available tests if applicable (npm/vitest) but do not hang.
- After finishing, report files created/modified and tests run.
- Read SOURCE_PROMPT.md first and align deliverables to it. Do not add or remove modules.
{dep_context}

Begin now.
"""

print(f"=== {tid} :: {task['agent_id']} :: {task['title']} ===")
eid, result = rt.run_task(conn, tid, prompt, adapter=adapter, model=MODEL)
print("Execution:", eid)
print("Status:", result.get('status'))
err=result.get('error')
if err: print("Error:", str(err)[:1000])
out=result.get('output','') or ''
Path(f'{ROOT}/.factory/outputs').mkdir(parents=True, exist_ok=True)
Path(f'{ROOT}/.factory/outputs/{tid}.txt').write_text(out[:20000])
if result.get('status')=='COMPLETED':
    rt.update_task_status(conn, tid, 'COMPLETED', actor='AG-001', evidence=[eid])
    print("Marked COMPLETED")
else:
    print("NOT completed")
conn.close()

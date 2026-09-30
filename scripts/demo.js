import { makeSource } from './core.js';
import { put, get } from './storage.js';
export async function loadDemo() {
  const id = 'demo:os';
  if (!await get('courses', id)) {
    await put('courses', { id, name: 'CS2106 · Example materials', troubleTopics: [], updatedAt: Date.now(), demo: true });
    const materials = [
      { title: 'Processes & scheduling · original example', activity: 'lecture', week: '2', text: '# Process states\nReady processes can run; blocked processes wait for an event. A context switch saves the old CPU state and restores the next process.\n\n# Scheduling metrics\nTurnaround = completion − arrival. Waiting = turnaround − CPU burst (for a single CPU burst). Response = first run − arrival.\n\n# Round robin\nEach ready process receives up to one quantum. A smaller quantum improves responsiveness but increases context-switch overhead.\n\n# Address translation\nFor page size $2^k$, offset uses $k$ bits. $\\mathrm{VA}=\\mathrm{VPN}\\cdot 2^k+\\mathrm{offset}$. Translation maps VPN to physical frame number.' },
      { title: 'Synchronization practice · original example', activity: 'tutorial', week: '3', text: '# Race conditions\nA read-modify-write sequence is not atomic. Interleavings can lose updates even when each read and write is individually atomic.\n\n# Critical-section method\n1. Identify shared state and invariants.\n2. Identify every read and update.\n3. Protect the complete operation with the same lock.\n4. Check lock release on every exit path.\n\n# Deadlock conditions\nMutual exclusion, hold-and-wait, no preemption, and circular wait must all hold for deadlock. Breaking one condition prevents this class of deadlock.\n\n# Lock ordering pitfall\nAll threads must acquire multiple locks in the same global order. A local order chosen differently by each function can create a cycle.' },
      { title: 'Shell & debugging · original example', activity: 'lab', week: '3', text: '# Compile with diagnostics\n```sh\ncc -Wall -Wextra -g program.c -o program\n```\n\n# Check assumptions\nInspect return values before using outputs. Reproduce the failing input, isolate the smallest case, then inspect state at the failing operation.\n\n# Memory errors\nAn out-of-bounds access can appear to work and still be undefined behavior. Check indices, allocation size and object lifetime.\n\n# Method selection\n| Goal | Tool |\n| --- | --- |\n| Locate crash | debugger backtrace |\n| Find invalid access | memory sanitizer |\n| Inspect state | breakpoint and variables |' }
    ];
    for (const item of materials) await put('sources', makeSource({ ...item, courseId: id, format: 'md' }));
  }
  return id;
}

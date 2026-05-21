import uuid
import time
import re
from locust import task, between, events
from locust.contrib.fasthttp import FastHttpUser

class AgentWorkflowUser(FastHttpUser):
    """
    Locust load testing client simulating the Vibe Hub Server Bridge multi-step journey.
    Utilizes FastHttpUser for low overhead, supporting high concurrent VU counts.
    """
    
    # Simulate a think time of 1-3 seconds between starting new workflows
    wait_time = between(1, 3)

    def on_start(self):
        """
        Dynamically initializes the authenticated session for the VU before running tasks.
        """
        self.handoff_code = None
        self.csrf_token = ""
        
        # 1. Trigger the Mock OAuth flow. Capture the redirect (do not follow automatically)
        # to pull the handoff code out of the redirect location.
        auth_url = "/api/auth/github?returnOrigin=http://localhost:3001"
        with self.client.get(auth_url, allow_redirects=False, catch_response=True) as response:
            if response.status_code == 302:
                location = response.headers.get("Location", "")
                match = re.search(r"code=([^&]+)", location)
                if match:
                    self.handoff_code = match.group(1)
                    response.success()
                else:
                    response.failure(f"Handoff code missing from redirect location: {location}")
                    return
            else:
                response.failure(f"Mock OAuth redirect failed with status: {response.status_code}")
                return

        # 2. Exchange the handoff code for HTTP-only cookies
        payload = {"code": self.handoff_code}
        with self.client.post("/api/auth/handoff", json=payload, catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Auth handoff failed with status: {response.status_code}")
                return

        # 3. Retrieve the CSRF token from the session
        with self.client.get("/api/v6/csrf-token", catch_response=True) as response:
            if response.status_code == 200:
                try:
                    self.csrf_token = response.json().get("csrfToken", "")
                    response.success()
                except Exception as e:
                    response.failure(f"Failed to parse CSRF response body: {e}")
            else:
                response.failure(f"CSRF token endpoint returned status: {response.status_code}")

    @task
    def run_agent_workflow(self):
        """
        Enqueues an async agent workflow and polls the job status endpoint until completion.
        """
        if not getattr(self, "handoff_code", None) or not self.csrf_token:
            # Skip workflow task if dynamic login failed during on_start
            return

        user_id = str(uuid.uuid4())
        socket_id = f"locust-socket-{user_id[:8]}"
        idempotency_key = f"locust-idemp-{uuid.uuid4()}"

        payload = {
            "prompt": "Implement high-performance AST parsing with robust path boundaries.",
            "userId": user_id,
            "targetFile": f"load/locust-bench-{user_id[:8]}.js",
            "effortLevel": "standard",
            "queueLane": "interactive",
            "socketId": socket_id
        }

        headers = {
            "X-CSRF-Token": self.csrf_token,
            "Idempotency-Key": idempotency_key,
            "Content-Type": "application/json"
        }

        start_time = time.time()
        job_id = None

        # Step A: Enqueue code orchestration run
        with self.client.post("/api/v6/code", json=payload, headers=headers, catch_response=True) as response:
            if response.status_code in [200, 202]:
                response.success()
                if response.status_code == 202:
                    try:
                        job_id = response.json().get("jobId")
                    except Exception:
                        pass
            else:
                response.failure(f"Agent workflow submission failed with status: {response.status_code}")
                return

        if not job_id:
            # Inline processing or fast-circuit rate limit, complete early
            return

        # Step B: Poll async status endpoint until done
        completed = False
        attempts = 0
        max_attempts = 30 # Poll for up to 60s (30 * 2s sleep)

        while not completed and attempts < max_attempts:
            time.sleep(2)
            attempts += 1

            with self.client.get(f"/api/v6/code/jobs/{job_id}", catch_response=True) as poll_response:
                if poll_response.status_code == 200:
                    try:
                        job_data = poll_response.json().get("job", {})
                        state = job_data.get("state")
                        
                        if state in ["completed", "completed_job_finished", "success"]:
                            completed = True
                            poll_response.success()
                            
                            # Log and record end-to-end custom metric for full loop processing latency
                            total_duration_ms = int((time.time() - start_time) * 1000)
                            events.request.fire(
                                request_type="Orchestrator_Workflow",
                                name="agent_job_completion_time",
                                response_time=total_duration_ms,
                                response_length=0,
                                exception=None
                            )
                        elif state in ["failed", "fatal_failure", "dead-lettered"]:
                            completed = True
                            poll_response.success()
                        else:
                            poll_response.success() # Still running, continue polling
                    except Exception as e:
                        poll_response.failure(f"Failed to parse job status JSON: {e}")
                        break
                else:
                    poll_response.failure(f"Queue job status polling failed with status: {poll_response.status_code}")
                    break

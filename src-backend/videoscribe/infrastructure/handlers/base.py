from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from videoscribe.domain.cancellation import CancellationToken

class BaseHandler(ABC):
    @abstractmethod
    def handle(self, job_id: str, payload: Dict[str, Any], cancel_token: Optional[CancellationToken]):
        pass

    @abstractmethod
    def cleanup(self):
        """
        Forcefully release any heavy resources (like GPU models) held by the handler.
        Must be called by the router after handle() completes.
        """
        pass

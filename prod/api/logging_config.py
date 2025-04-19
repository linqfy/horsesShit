import logging
import json


class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "message": record.getMessage(),
            "name": record.name,
            "filename": record.filename,
            "function": record.funcName,
            "line_no": record.lineno,
        }
        return json.dumps(log_record)


# Configuración del logger para que use JSONFormatter
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("horses_management")
handler = logging.StreamHandler()
formatter = JSONFormatter()
handler.setFormatter(formatter)
logger.addHandler(handler)
logger.propagate = False

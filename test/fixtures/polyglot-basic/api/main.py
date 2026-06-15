from .services import AccessService

class AccessController:
    pass

@router.get("/access/open")
def open_access():
    return AccessService().can_open()

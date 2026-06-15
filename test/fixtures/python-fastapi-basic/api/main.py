from .service import UserService

class UserController:
    pass

@router.post("/users")
def create_user():
    return UserService().create()

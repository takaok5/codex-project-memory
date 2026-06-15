from api.service import UserService

def test_create():
    assert UserService().create()["ok"] is True

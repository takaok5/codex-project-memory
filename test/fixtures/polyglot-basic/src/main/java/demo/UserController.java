package demo;

import demo.UserService;

public class UserController {
  @GetMapping("/users")
  public String users() { return "ok"; }
}

package demo;

public class UserController {
  @GetMapping("/users")
  public String users() { return "ok"; }
}

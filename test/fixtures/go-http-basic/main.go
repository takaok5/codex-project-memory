package main

type HealthService struct {}

func main() {
    http.HandleFunc("/health", health)
}

func health(w http.ResponseWriter, r *http.Request) {}

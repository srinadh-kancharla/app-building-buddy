import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Trophy, 
  Radio, 
  Calendar, 
  Users, 
  ArrowRight, 
  Zap,
  Shield,
  BarChart3
} from 'lucide-react';

export default function Index() {
  const { user, isOrganizer } = useAuth();

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
        <div className="absolute top-20 left-1/4 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        
        <div className="container relative py-24 md:py-32">
          <div className="max-w-3xl mx-auto text-center animate-fade-in">
            <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm font-medium">
              <Radio className="h-3 w-3 mr-2 text-live animate-pulse-live" />
              Live Cricket Scores
            </Badge>
            
            <h1 className="text-5xl md:text-7xl font-display tracking-tight mb-6">
              YOUR CRICKET
              <br />
              <span className="text-gradient">TOURNAMENT HUB</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl mx-auto">
              Create tournaments, manage matches, and follow live scores. 
              The ultimate platform for cricket enthusiasts and organizers.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="bg-gradient-hero hover:opacity-90 text-lg h-12 px-8" asChild>
                <Link to="/tournaments">
                  Explore Tournaments
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              
              {!user && (
                <Button size="lg" variant="outline" className="text-lg h-12 px-8" asChild>
                  <Link to="/auth">Get Started Free</Link>
                </Button>
              )}
              
              {isOrganizer && (
                <Button size="lg" variant="outline" className="text-lg h-12 px-8" asChild>
                  <Link to="/dashboard">Organizer Dashboard</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-display mb-4">
              EVERYTHING YOU NEED
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              From organizing local tournaments to following international matches
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="card-hover border-0 shadow-md bg-card">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Trophy className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Create Tournaments</h3>
                <p className="text-muted-foreground">
                  Set up cricket tournaments with custom formats, team registrations, and match schedules.
                </p>
              </CardContent>
            </Card>

            <Card className="card-hover border-0 shadow-md bg-card">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                  <Radio className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Live Scoring</h3>
                <p className="text-muted-foreground">
                  Real-time score updates with ball-by-ball commentary for every match.
                </p>
              </CardContent>
            </Card>

            <Card className="card-hover border-0 shadow-md bg-card">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-cricket-gold/10 flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-cricket-gold" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Team Management</h3>
                <p className="text-muted-foreground">
                  Add teams, manage players, and invite scorers to update match data.
                </p>
              </CardContent>
            </Card>

            <Card className="card-hover border-0 shadow-md bg-card">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Match Scheduling</h3>
                <p className="text-muted-foreground">
                  Create match fixtures with venue assignments and automated reminders.
                </p>
              </CardContent>
            </Card>

            <Card className="card-hover border-0 shadow-md bg-card">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                  <BarChart3 className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Statistics</h3>
                <p className="text-muted-foreground">
                  Detailed stats for players, teams, and tournaments with leaderboards.
                </p>
              </CardContent>
            </Card>

            <Card className="card-hover border-0 shadow-md bg-card">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-cricket-gold/10 flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-cricket-gold" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Role-Based Access</h3>
                <p className="text-muted-foreground">
                  Admin controls, organizer dashboards, and viewer-only access for fans.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container">
          <Card className="border-0 bg-gradient-hero text-primary-foreground overflow-hidden relative">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-96 h-96 bg-white/20 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/20 rounded-full translate-y-1/2 -translate-x-1/2" />
            </div>
            <CardContent className="relative p-12 md:p-16 text-center">
              <Zap className="h-12 w-12 mx-auto mb-6 text-cricket-gold" />
              <h2 className="text-3xl md:text-4xl font-display mb-4">
                READY TO START YOUR TOURNAMENT?
              </h2>
              <p className="text-primary-foreground/80 text-lg mb-8 max-w-xl mx-auto">
                Join thousands of organizers already using CricketLive to manage their tournaments.
              </p>
              <Button 
                size="lg" 
                variant="secondary"
                className="text-lg h-12 px-8"
                asChild
              >
                <Link to={user ? '/dashboard' : '/auth'}>
                  {user ? 'Go to Dashboard' : 'Create Free Account'}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </Layout>
  );
}
